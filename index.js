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

// async function run() {
//     try {
//         // Connect the client to the server	(optional starting in v4.7)
//         await client.connect();

client.connect(() => {
    console.log('connecting to MOngo db');
}).catch(console.dir)

const database = client.db("PromptCanvas_db");
const promptsCollection = database.collection("prompts");
const usersCollection = database.collection('user');
const bookmarksCollection = database.collection('bookmarks');
const reviewsCollection = database.collection('reviews');
const reportsCollection = database.collection('reports');
const paymentCollection = database.collection('payment');
const subscriptionsCollection = database.collection('subscriptions');
const sessionCollection = database.collection('session');


// verification
const verifyToken = async (req, res, next) => {

    const authHeader = req.headers?.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const query = { token: token }
    const session = await sessionCollection.findOne(query);

    if (!session) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    const userId = session.userId;
    // console.log(userId)

    const userQuery = {
        _id: userId
    }

    const user = await usersCollection.findOne(userQuery);
    if (!user) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = user;
    next();
}

// must be used after verifyToken middleware
const verifyUserOrCreator = (req, res, next) => {

    if (
        req.user.role !== "user" &&
        req.user.role !== "creator"
    ) {
        return res.status(403).send({
            message: "Forbidden access"
        });
    }

    next();
};

// must be used after verifyToken middleware
const verifyAdmin = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next();
}

// user related apis
app.get('/api/users', async (req, res) => {
    const cursor = usersCollection.find().skip(3);
    const result = await cursor.toArray();
    res.send(result);
})

app.delete('/api/users/:id', async (req, res) => {

    try {

        const id = req.params.id;

        const filter = {
            _id: new ObjectId(id),
        };

        const result = await usersCollection.deleteOne(filter);

        res.send(result);

    } catch (error) {

        res.status(500).send({
            success: false,
            message: error.message,
        });

    }

});

// prompts related apis
//   home all prompt page 
// app.get('/api/prompts', async (req, res) => {
//     const { page = 1, limit = 10 } = req.query;
//     const skip = (Number(page) - 1) * Number(limit);

//     const result = await promptsCollection
//         .find({ status: "approved" }).skip(skip).limit(Number(limit))
//         .toArray();

//     const totalData = await promptsCollection.countDocuments();
//     const totalPage = Math.ceil(totalData / Number(limit));

//     res.send({ data: result, page: Number(page) , totalPage});
// });

app.get('/api/prompts', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 9,
            search = "",
            category,
            tool,
            difficulty,
            sort = "newest",
        } = req.query;

        // Base query
        const query = { status: "approved" };

        // Search
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { tags: { $regex: search, $options: "i" } },
                { creatorName: { $regex: search, $options: "i" } },
            ];
        }

        // Filters
        if (category && category !== "all") query.category = category;
        if (tool && tool !== "all") query.tool = tool;
        if (difficulty && difficulty !== "all") query.difficulty = difficulty;

        // Sort
        let sortOption = { createdAt: -1 };
        if (sort === "copies") sortOption = { copyCount: -1 };
        if (sort === "az") sortOption = { title: 1 };

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);
        const totalData = await promptsCollection.countDocuments(query); // query দিয়ে count করো!
        const totalPage = Math.ceil(totalData / Number(limit));

        const result = await promptsCollection
            .find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(Number(limit))
            .toArray();

        res.send({ data: result, page: Number(page), totalPage });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// creator prompts
app.get('/api/creator/prompts', verifyToken, verifyUserOrCreator, async (req, res) => {
    const query = {};
    if (req.query.creatorId) {
        query.creatorId = req.query.creatorId;

        // check whether asking for user information or someone else
        // console.log(req.user, req.query.creatorId)
        if (req.user._id.toString() !== req.query.creatorId) {
            return res.status(403).send({ message: 'forbidden access' })
        }
    }
    if (req.query.status) {
        query.status = req.query.status;
    }
    const cursor = promptsCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

// admin allPrompts page prompt
app.get("/api/admin/prompts", verifyToken, verifyAdmin, async (req, res) => {

    const result = await promptsCollection.find().toArray();

    res.send(result);
}
);

app.get("/api/admin/analytics", async (req, res) => {
    try {

        const totalUsers = await usersCollection.countDocuments();

        const totalPrompts = await promptsCollection.countDocuments();

        const totalReviews = await reviewsCollection.countDocuments();

        const copyResult = await promptsCollection.aggregate([
            {
                $group: {
                    _id: null,
                    totalCopies: {
                        $sum: "$copyCount"
                    }
                }
            }
        ]).toArray();

        const totalCopies = copyResult[0]?.totalCopies || 0;

        res.send({
            totalUsers,
            totalPrompts,
            totalReviews,
            totalCopies,
        });

    } catch (error) {

        console.log(error);

        res.status(500).send({
            message: "Failed to load analytics"
        });

    }
});

app.get("/api/prompts/featured", async (req, res) => {
    const result = await promptsCollection.find({ status: "approved" }).limit(6).toArray();
    res.send(result);
});

app.get('/api/prompts/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const query = {
        _id: new ObjectId(id)
    }
    const result = await promptsCollection.findOne(query);
    res.send(result);
})

// top creator
app.get("/api/creators/top", async (req, res) => {

    const result = await promptsCollection.aggregate([

        {
            $match: {
                status: "approved"
            }
        },

        {
            $group: {
                _id: "$creatorId",

                creatorName: {
                    $first: "$creatorName"
                },

                creatorImage: {
                    $first: "$creatorImage"
                },

                totalPrompts: {
                    $sum: 1
                },

                totalCopies: {
                    $sum: "$copyCount"
                }
            }
        },

        {
            $sort: {
                totalCopies: -1
            }
        },

        {
            $limit: 6
        }

    ]).toArray();

    res.send(result);

});

app.post('/api/prompts', verifyToken, verifyUserOrCreator, async (req, res) => {
    const prompt = req.body;
    const newPrompt = {
        ...prompt,
        createdAt: new Date(),
    }
    const result = await promptsCollection.insertOne(newPrompt);
    res.send(result);
})

app.patch('/api/prompts/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const updatedPrompt = req.body;
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
        $set: {
            status: updatedPrompt.status,
        }
    }
    const result = await promptsCollection.updateOne(filter, updatedDoc);
    res.send(result)
})

app.patch("/api/prompts/update/:id", verifyToken, verifyUserOrCreator, async (req, res) => {

    const id = req.params.id;
    const updatedPrompt = req.body;

    const existingPrompt = await promptsCollection.findOne({
        _id: new ObjectId(id),
    });

    if (!existingPrompt) {
        return res.status(404).send({
            message: "Prompt not found",
        });
    }

    const updateDoc = {
        $set: {
            title: updatedPrompt.title,
            updatedAt: new Date(),
        },
    };

    const result = await promptsCollection.updateOne(
        {
            _id: new ObjectId(id),
        },
        updateDoc
    );

    res.send(result);
}
);

app.delete('/api/prompts/:id', verifyToken, async (req, res) => {

    const id = req.params.id;
    // console.log(id)

    const filter = {
        _id: new ObjectId(id)
    };

    const result = await promptsCollection.deleteOne(filter);

    res.send(result);

});

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

app.get("/api/bookmarks", verifyToken, async (req, res) => {

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
app.get('/api/reviews', async (req, res) => {

    const reviews = await reviewsCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

    res.send(reviews);

});

app.get("/api/reviews/prompt/:promptId", verifyToken, async (req, res) => {

    const promptId = req.params.promptId;

    const result = await reviewsCollection.find({ promptId }).sort({ createdAt: -1 }).toArray();
    res.send(result);

});

app.get("/api/reviews/user-review", verifyToken, async (req, res) => {

    const { promptId, userId } = req.query;

    const result = await reviewsCollection.findOne({
        promptId,
        userId
    });

    res.send(result);

});

app.get("/api/reviews/user/:userId", verifyToken, async (req, res) => {
    const { userId } = req.params;

    const result = await reviewsCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

    res.send(result);
});

app.get("/api/reviews/rating/:promptId", verifyToken, async (req, res) => {

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

app.post("/api/reviews", verifyToken, async (req, res) => {

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


// report related apis
app.get('/api/reports', verifyToken, verifyAdmin, async (req, res) => {

    const reports = await reportsCollection.find().sort({
        createdAt: -1
    }).toArray();

    res.send(reports);

});

app.post("/api/reports", verifyToken, async (req, res) => {

    const report = req.body;

    report.createdAt = new Date();

    const result = await reportsCollection.insertOne(report);

    res.send(result);

});

// app.delete('/api/reports/warn/:id', async (req, res) => {

//     const id = req.params.id;

//     const result = await reportsCollection.deleteOne({
//         _id: new ObjectId(id)
//     });

//     res.send(result);

// });

app.delete('/api/reports/remove-prompt/:id', verifyToken, verifyAdmin, async (req, res) => {

    const id = req.params.id;

    const report = await reportsCollection.findOne({
        _id: new ObjectId(id)
    });

    if (!report) {
        return res.status(404).send({ message: "Report not found" });
    }

    await promptsCollection.deleteOne({
        _id: new ObjectId(report.promptId)
    });

    const result = await reportsCollection.deleteOne({
        _id: new ObjectId(id)
    });

    res.send(result);

});

app.delete('/api/reports/dismiss/:id', verifyToken, verifyAdmin, async (req, res) => {

    const id = req.params.id;

    const result = await reportsCollection.deleteOne({
        _id: new ObjectId(id)
    });

    res.send(result);

});


// copy related apis
app.patch("/api/prompts/copy/:id", async (req, res) => {

    const id = req.params.id;
    // console.log(id)

    const result = await promptsCollection.updateOne(
        {
            _id: new ObjectId(id)
        },
        {
            $inc: {
                copyCount: 1
            }
        }
    );

    res.send(result);

});

// payment related apis
app.get('/api/payments', verifyToken, async (req, res) => {
    const query = {};
    if (req.query.payment_id) {
        query.payment_id = req.query.payment_id;
    }
    const payment = await paymentCollection.findOne(query);
    res.send(payment);
})

// subscription related apis 
app.get('/api/subscriptions', verifyToken, verifyAdmin, async (req, res) => {

    const subscriptions = await subscriptionsCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

    res.send(subscriptions);

});

app.post('/api/subscriptions', verifyToken, async (req, res) => {
    const data = req.body;
    // console.log(data)
    const subsInfo = {
        ...data,
        createdAt: new Date()
    }
    const result = await subscriptionsCollection.insertOne(subsInfo);

    // update user plan
    const filter = { email: data.email };
    const updateDocument = {
        $set: {
            plan: data.plan
        }
    }
    const updatedResult = await usersCollection.updateOne(filter, updateDocument);
    res.send(updatedResult);
})

// search related api
// app.get("/api/prompts", async (req, res) => {
//     console.log("API HIT");
//     console.log(req.query);
//     try {

//         const {
//             search = "",
//             category,
//             tool,
//             difficulty,
//             sort = "newest",
//         } = req.query;

//         const query = {
//             status: "approved",
//         };


//         // Search
//         if (search) {
//             query.$or = [
//                 {
//                     title: {
//                         $regex: search,
//                         $options: "i",
//                     },
//                 },
//                 {
//                     description: {
//                         $regex: search,
//                         $options: "i",
//                     },
//                 },
//                 {
//                     tags: {
//                         $regex: search,
//                         $options: "i",
//                     },
//                 },
//                 {
//                     creatorName: {
//                         $regex: search,
//                         $options: "i",
//                     },
//                 },
//             ];
//         }

//         // Category
//         if (category && category !== "all") {
//             query.category = category;
//         }

//         // Tool
//         if (tool && tool !== "all") {
//             query.tool = tool;
//         }

//         // Difficulty
//         if (difficulty && difficulty !== "all") {
//             query.difficulty = difficulty;
//         }

//         let sortOption = {
//             createdAt: -1,
//         };

//         if (sort === "copies") {
//             sortOption = {
//                 copyCount: -1,
//             };
//         }

//         if (sort === "az") {
//             sortOption = {
//                 title: 1,
//             };
//         }

//         const result = await promptsCollection
//             .find(query)
//             .sort(sortOption)
//             .toArray();

//         res.send(result);

//     } catch (error) {

//         res.status(500).send({
//             message: error.message,
//         });

//     }
// });




// Send a ping to confirm a successful connection
// await client.db("admin").command({ ping: 1 });
// console.log("Pinged your deployment. You successfully connected to MongoDB!");
//     } finally {
//         // Ensures that the client will close when you finish/error
//         // await client.close();
//     }
// }
// run().catch(console.dir);



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})


module.exports = app;