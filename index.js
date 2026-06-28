const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT;
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
    // await client.connect();
    const database = client.db("HireLoopDB");
    const jobsCollection = database.collection("jobs");
    const companiesCollection = database.collection("companies");
    const jobApplicationsCollection = database.collection("applications");
    const planCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");
    const sessionCollection = database.collection("session");
    const userCollection = database.collection("user");

    // verify related middle ware
    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorized" });
      }

      const query = {
        token: token,
      };
      const session = await sessionCollection.findOne(query);
      const userQuery = {
        _id: session?.userId,
      };
      const user = await userCollection.findOne(userQuery);

      req.user = user;
      next();
    };

    const verifySeeker = async (req, res, next) => {
      const user = req.user;
      if (user.role !== "seeker") {
        return res.status(403).send({ message: "forbidden" });
      }
      next();
    };

    // admin verification
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      if (user.role !== "admin") {
        return res.status(403).send({ message: "forbidden" });
      }
      next();
    };
    // recruiter verification
    const verifyRecruiter = async (req, res, next) => {
      const user = req.user;
      if (user.role !== "recruiter") {
        return res.status(403).send({ message: "forbidden" });
      }
      next();
    };

    // get jobs api
    app.get("/api/jobs", async (req, res) => {
      try {
        const query = {};
        if (req.query.search) {
          query.$or = [
            { title: { $regex: req.query.search, $options: "i" } },
            { requirements: { $regex: req.query.search, $options: "i" } },
          ];
        }
        if (req.query.location) {
          query.$or = [
            { location: { $regex: req.query.location, $options: "i" } },
          ];
        }

        if (req.query.isRemote === "true") {
          query.isRemote = true;
        }

        if (req.query.jobType) {
          const jobTypesArray = req.query.jobType
            .split(",")
            .filter((type) => type !== "Remote");

          if (jobTypesArray.length > 0) {
            query.jobType = { $in: jobTypesArray };
          }
        }
        // pagination

        if (req.query.page) {
          const page = req.query.page;
          const perPage = req.query.perPage || 8;
          const skipItem = (page - 1) * perPage;
          const jobs = await jobsCollection
            .find(query)
            .skip(skipItem)
            .limit(perPage)
            .toArray();
          const total = await jobsCollection.countDocuments(query);
          return res.send({jobs, total});
        }
        // company related
        if (req.query.companyId) {
          query.companyId = req.query.companyId;
        }
        if (req.query.status) {
          query.status = req.query.status;
        }

        const result = await jobsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).send({ message: "Internal server error" });
      }
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
    app.post("/api/jobs", verifyToken, verifyRecruiter, async (req, res) => {
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
    app.get(
      "/api/applications",
      verifyToken,
      verifySeeker,
      async (req, res) => {
        const query = {};
        if (req.query.applicantId) {
          query.applicantId = req.query.applicantId;
        }
        // check user id and applicant id matched or not
        if (req.user._id.toString() !== req.query.applicantId) {
          return res.status(403).send({ message: "forbidden" });
        }
        if (req.query.jobId) {
          query.jobId = req.query.jobId;
        }

        const result = await jobApplicationsCollection.find(query).toArray();
        res.send(result);
      },
    );

    // // get companies data
    app.get("/api/my/companies", verifyToken, async (req, res) => {
      const query = {};
      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }
      const result = await companiesCollection.find(query).toArray();
      res.send(result);
    });

    // admin company update api
    app.patch(
      "/api/companies/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const companyData = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: companyData.status,
          },
        };
        const result = await companiesCollection.updateOne(filter, updateDoc);
        res.send(result);
      },
    );
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
    // await client.db("admin").command({ ping: 1 });
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
