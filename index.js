const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGO_DB_URI;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    const database = client.db("HireLoopDB");
    const jobsCollection = database.collection("jobs");
    const companiesCollection = database.collection("companies");
    const jobApplicationsCollection = database.collection("applications");
    const planCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");
    const userCollection = database.collection("user");

    // get jobs api
    app.get("/api/jobs", async (req, res) => {
      const query = {};
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // get specific job by id
    app.get("/api/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // add now post api
    app.post("/api/jobs", async (req, res) => {
      const Job = req.body;
      const newJob = {
        ...Job,
        createdAt: new Date(),
      };
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    // company apis
    app.post("/api/companies", async (req, res) => {
      const company = req.body;
      const newCompany = {
        ...company,
        createdAt: new Date(),
      };
      const result = await companiesCollection.insertOne(newCompany);

      res.send(result);
    });
    // applications post api
    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const newApplication = {
        ...application,
        createdAt: new Date(),
      };
      const result = await jobApplicationsCollection.insertOne(newApplication);
      res.send(result);
    });
    // subscriptions post api
    app.post("/api/subscriptions", async (req, res) => {
      const subscription = req.body;
      const newSubscription = {
        ...subscription,
        createdAt: new Date(),
      };
      const result = await subscriptionCollection.insertOne(newSubscription);
      const filter = { email: subscription.email };
      const updateData = {
        $set: {
          plan: subscription.planId,
        },
      };
      const finalResult = await userCollection.updateOne(filter, updateData);
      res.send(finalResult);
    });

    // applicant data get api
    app.get("/api/applications", async (req, res) => {
      const query = {};
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;
      }
      if (req.query.jobId) {
        query.jobId = req.query.jobId;
      }

      const result = await jobApplicationsCollection.find(query).toArray();
      res.send(result);
    });

    // // get companies data
    app.get("/api/my/companies", async (req, res) => {
      const query = {};
      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }
      const result = await companiesCollection.find(query).toArray();
      res.send(result);
    });

    // admin company update api
    app.patch("/api/companies/:id", async (req, res) => {
      const id = req.params.id;
      const companyData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: companyData.status,
        },
      };
      const result = await companiesCollection.updateOne(filter, updateDoc);
    });
    // // plans Get api
    app.get("/api/plans", async (req, res) => {
      const query = {};
      if (req.query.plan_id) {
        query.plan_id = req.query.plan_id;
      }
      const result = await planCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
