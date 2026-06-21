const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;
const dotenv = require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
        const bookmarksCollection = database.collection('bookmarks');
        const reviewsCollection = database.collection('reviews');
        const reportsCollection = database.collection('reports');
        const subscriptionsCollection = database.collection('subscriptions');

        // user related apis
        app.get('/api/users', async (req, res) => {
            const cursor = usersCollection.find().skip(3);
            const result = await cursor.toArray();
            res.send(result);
        })

        // prompts related apis
        app.get('/api/prompts', async (req, res) => {
            const query = {};
            if (req.query.creatorId) {
                query.creatorId = req.query.creatorId;
            }
            if (req.query.status) {
                query.status = req.query.status;
            }
            const cursor = promptsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get("/api/prompts/featured", async (req, res) => {
            const result = await promptsCollection.find({ status: "approved" }).limit(6).toArray();
            res.send(result);
        });

        app.get('/api/prompts/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const result = await promptsCollection.findOne(query);
            res.send(result);
        })

        app.post('/api/prompts', async (req, res) => {
            const prompt = req.body;
            const newPrompt = {
                ...prompt,
                createdAt: new Date(),
            }
            const result = await promptsCollection.insertOne(newPrompt);
            res.send(result);
        })

        // bookmark related apis
        app.get("/api/bookmarks/check", async (req, res) => {

            const { promptId, userEmail } = req.query;

            const bookmark = await bookmarksCollection.findOne({
                promptId,
                userEmail
            });

            res.send({
                bookmarked: !!bookmark
            });

        });

        app.get("/api/bookmarks", async (req, res) => {

            const { userEmail } = req.query;

            const result = await bookmarksCollection.find({
                userEmail
            }).toArray();

            res.send(result);

        });

        app.post("/api/bookmarks", async (req, res) => {

            const bookmark = req.body;

            const existing = await bookmarksCollection.findOne({
                promptId: bookmark.promptId,
                userEmail: bookmark.userEmail
            });

            if (existing) {
                return res.status(400).send({
                    message: "Already Bookmarked"
                });
            }

            bookmark.createdAt = new Date();

            const result = await bookmarksCollection.insertOne(bookmark);

            res.send(result);

        });

        app.delete("/api/bookmarks", async (req, res) => {

            const { promptId, userEmail } = req.body;

            const result = await bookmarksCollection.deleteOne({
                promptId,
                userEmail
            });

            res.send(result);

        });


        // reviews related apis
        app.get("/api/reviews/:promptId", async (req, res) => {

            const promptId = req.params.promptId;

            const result = await reviewsCollection.find({ promptId }).sort({ createdAt: -1 }).toArray();
            res.send(result);

        });

        app.get("/api/reviews/rating/:promptId", async (req, res) => {

            const promptId = req.params.promptId;

            const reviews = await reviewsCollection.find({ promptId }).toArray();

            if (reviews.length === 0) {
                return res.send({
                    average: 0,
                    total: 0,
                });
            }

            const totalRating = reviews.reduce((sum, item) => sum + Number(item.rating), 0);

            res.send({
                average: Number((totalRating / reviews.length).toFixed(1)),
                total: reviews.length,
            });

        });

        app.post("/api/reviews", async (req, res) => {

            const review = req.body;

            const existing = await reviewsCollection.findOne({
                promptId: review.promptId,
                userEmail: review.userEmail,
            });

            if (existing) {
                return res.status(400).send({
                    message: "You already reviewed this prompt",
                });
            }

            review.createdAt = new Date();

            const result = await reviewsCollection.insertOne(review);

            res.send(result);

        });


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