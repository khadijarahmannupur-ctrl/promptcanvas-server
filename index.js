const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;
const dotenv = require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!')
})




const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("PromptCanvas_db");
        const promptsCollection = database.collection("prompts");
        const usersCollection = database.collection('user');

        // user related apis
        app.get('/api/users', async(req, res)=> {
           const cursor = usersCollection.find().skip(3);
           const result = await cursor.toArray();
           res.send(result);
        })

        // prompts related apis
        app.get('/api/prompts', async(req, res)=> {
            const query = {};
            if(req.query.creatorId){
                query.creatorId = req.query.creatorId;
            }
            if(req.query.status){
                query.status = req.query.status;
            }
            const cursor = promptsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/api/prompts', async(req, res)=> {
            const prompt = req.body;
            const newPrompt = {
                ...prompt,
                createdAt : new Date(),
            }
            const result = await promptsCollection.insertOne(newPrompt);
            res.send(result);
        }) 


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})