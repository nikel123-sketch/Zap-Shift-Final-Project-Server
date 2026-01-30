// ------------dotenv---------
require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

// stripe---
const stripe = require("stripe")(process.env.DB_STRIPE);

// fb token---
const admin = require("firebase-admin");



const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// madilware---
app.use(express.json());
app.use(cors());


// verifytoken ----
const verifyFbToken = async (req, res, next) => {
  // console.log(req.headers.authorization);
  const fbToken = req.headers.authorization;
  if (!fbToken) {
    return res.status(401).send({ message: "unauthorized access token" });
  }
  try{
    const idToken=fbToken.split(' ')[1];
    // console.log(idToken)
    const decoded=await admin.auth().verifyIdToken(idToken)
    // console.log('decoded token',decoded)
    req.decoded_email=decoded.email;

    next();
  }
  catch(err){
    return res.status(401).send({ message: "unauthorized access token" });
  }
  
};



// traking id ---
const crypto = require("crypto");
function generateTrackingId() {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}

// mongodb uri---
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jquttsn.mongodb.net/?appName=Cluster0`;

//   mongodb client---
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// mongodb function---
async function run() {
  try {
    

    // db----
    const db = client.db("Zap_Shift_Final_Project_DB");
    const parcelscoll = db.collection("parcels");
    const paymentHistry = db.collection("paymenthistry");
    const usersColl = db.collection("users");
    const RiderColl = db.collection("riders");
    

    // admin verifytoken-madilware--
    const adminverifyToken = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersColl.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(401).send({ message: "forbidden access" });
      }

      next();
    };
    // admin verifytoken-madilware--
    const riderverifyToken = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersColl.findOne(query);
      if (!user || user.role !== "rider") {
        return res.status(401).send({ message: "forbidden access" });
      }

      next();
    };

   

    // all api here-----

    // ___________riders__________
    // riders post api---
    app.post("/riders",verifyFbToken, async (req, res) => {
      const rider = req.body;
      rider.time = new Date();

      rider.status = "panding";
      const email = rider.email;
      const existEmail = await RiderColl.findOne({ email });
      if (existEmail) {
        return res.send({ message: "email already exist" });
      }
      const result = await RiderColl.insertOne(rider);
      res.send(result);
    });

    // riders get api----
    app.get("/riders",verifyFbToken, adminverifyToken, async (req, res) => {
      const { status, district, workStatus } = req.query;

      const query = {};

      if (status) {
        query.status = status;
      }
      if (district) {
        query.Riderdistrict = district;
      }
      if (workStatus) {
        query.workStatus = workStatus;
      }
      const cursor = RiderColl.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // riders patch api--
    app.patch(
      "/riders/:id",
      verifyFbToken,
      adminverifyToken,
      
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const status = req.body.status;
        const update = {
          $set: {
            status: status,
            workStatus: "available",
          },
        };
        const result = await RiderColl.updateOne(query, update);

        if (status === "Approved") {
          const email = req.body.email;
          const userQuery = { email };
          const updateUser = {
            $set: {
              role: "rider",
            },
          };
          const resultUser = await usersColl.updateOne(userQuery, updateUser);
        }

        if (status === "Rejected") {
          const email = req.body.email;
          const userQuery = { email };
          const update = {
            $set: {
              role: "user",
            },
          };
          const rejectUser = await usersColl.updateOne(userQuery, update);
        }
        res.send(result);
      },
    );

    // rider delete api--
    app.delete("/riders/:id",verifyFbToken,adminverifyToken, async  (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await RiderColl.deleteOne(query);
      res.send(result);
    });


    

    // __________users________________
    // users post api--
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.time = new Date();
      // exist email--
      const email = user.email;
      const existEmail = await usersColl.findOne({ email });
      if (existEmail) {
        return res.send({ message: "already exist email" });
      }
      const result = await usersColl.insertOne(user);
      res.send(result);
    });

    // user get api---
    app.get("/users", verifyFbToken,adminverifyToken, async (req, res) => {
      const searchtext = req.query.searchtext;
      const query = {};
      if (searchtext) {
        query.$or = [
          { name: { $regex: searchtext, $options: "i" } },
          { email: { $regex: searchtext, $options: "i" } },
        ];
      }
      const cursor = usersColl.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // users patch api---
    app.patch(
      "/users/:id/role",
      verifyFbToken,
      adminverifyToken,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const roleinfo = req.body.role;
        const updaterole = {
          $set: {
            role: roleinfo,
          },
        };
        const result = await usersColl.updateOne(query, updaterole);
        res.send(result);
      },
    );

    // user get role email api--
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersColl.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    // ______parcels____________
    // parcels get api---
    app.get("/parcels",verifyFbToken, async (req, res) => {
      const query = {};
      const { email, delevaryStatus } = req.query;
      if (email) {
        query.SanderEmail = email;
      }
      if (delevaryStatus) {
        query.delevaryStatus = delevaryStatus;
      }

      const cursor = parcelscoll.find(query).sort({ cost: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // parcels get api assign rider---
    app.get("/parcels/rider",verifyFbToken, async (req, res) => {
      const { riderEmail, delevaryStatus } = req.query;
      const query = {};
      if (riderEmail) {
        query.riderEmail = riderEmail;
      }
      if (delevaryStatus != "parcel_Delevared") {
        // query.delevaryStatus = { $in: ["RiderAssign", "ridergoing"] };
        query.delevaryStatus = { $nin: ["parcel_Delevared"] };
      } else {
        query.delevaryStatus = delevaryStatus;
      }
      const cursor = parcelscoll.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // parcels post api--
    app.post("/parcels",verifyFbToken, async (req, res) => {
      const parcel = req.body;
      parcel.createdAt = new Date();
      const result = await parcelscoll.insertOne(parcel);
      res.send(result);
    });

    // parcel delete api---
    app.delete("/parcels/:id",verifyFbToken,adminverifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await parcelscoll.deleteOne(query);
      res.send(result);
    });

    //  pay parcel get api---
    app.get("/parcels/:id",verifyFbToken,adminverifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelscoll.findOne(query);
      res.send(result);
    });


    // parcels get api for piplile-----
    app.get("/parcels/delevaryStatus/stats",verifyFbToken,adminverifyToken, async (req, res) => {
      try {
        const pipeline = [
          {
            $group: {
              _id: "$delevaryStatus",
              count: { $sum:1 },
            },
          },
          {
            $project:{
              status:'$_id',
              count:1,
             
            }
          }
        ];

        const result = await parcelscoll.aggregate(pipeline).toArray();

        res.send(result);
      } catch (error) {
        // console.error(error);
        res.status(500).send({ message: "Failed to load delivery stats" });
      }
    });


    // delevary status parcels patch api----
    app.patch("/parcels/:id/status",verifyFbToken,riderverifyToken, async (req, res) => {
      const parcelId = req.params.id;
      const query = { _id: new ObjectId(parcelId) };
      const { delevaryStatus, riderId } = req.body;

      const parcelUpdate = {
        $set: {
          delevaryStatus: delevaryStatus,
        },
      };
      const result = await parcelscoll.updateOne(query, parcelUpdate);
     
      if (delevaryStatus === "parcel_Delevared") {
        //  rider update information---
        const riderQuery = { _id: new ObjectId(riderId) };
        const riderUpdate = {
          $set: {
            workStatus: "available",
          },
        };
        const riderResult = await RiderColl.updateOne(riderQuery, riderUpdate);
        // res.send(riderResult);
      }
      res.send(result)
    });

    // parcels patch api---
    app.patch("/parcels/:id",verifyFbToken,adminverifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { riderId, riderName, riderEmail } = req.body;
      const parcelUpdate = {
        $set: {
          delevaryStatus: "RiderAssign",
          riderId: riderId,
          riderName: riderName,
          riderEmail: riderEmail,
        },
      };
      const parcelResult = await parcelscoll.updateOne(query, parcelUpdate);

      //  rider update information---
      const riderQuery = { _id: new ObjectId(riderId) };
      const riderUpdate = {
        $set: {
          workStatus: "inDelivary",
        },
      };
      const riderResult = await RiderColl.updateOne(riderQuery, riderUpdate);
      res.send(riderResult);
    });

    // _________payment_______________
    // payment stripe post api----

    app.post("/create-checkout-session",verifyFbToken, async (req, res) => {
      const parcelinfo = req.body;
      const amount = parseInt(parcelinfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: parcelinfo.parcelName,
                description:
                  "The products description, meant to be displayable to the customer.",
              },
            },

            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: parcelinfo.SanderEmail,
        metadata: {
          parcelId: parcelinfo.parcelId,
          parcelName: parcelinfo.parcelName,
        },
        success_url: `${process.env.SITE_DOMAIN}/dasbord/PaySuccess?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dasbord/PayCancel`,
      });

      // console.log(session);
      res.send({ url: session.url });
    });

    // payment Success pacth check and api--
    app.patch("/paymentSuccess",verifyFbToken, async (req, res) => {
      const sessionId = req.query.session_id;

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // ----
      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };
      const paymentExist = await paymentHistry.findOne(query);
      // console.log(paymentExist);
      if (paymentExist) {
        return res.send({
          message: "already exist",
          transactionId,
          trackingId: paymentExist.trackingId,
        });
      }
      // console.log("this is session data", session);

      if (session.payment_status === "paid") {
        const id = session.metadata.parcelId;
        const trackingId = generateTrackingId();
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "paid",
            delevaryStatus: "Panding-Pickup",
            trackingId: trackingId,
          },
        };
        const result = await parcelscoll.updateOne(query, update);

        const paymentinfo = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId: session.metadata.parcelId,
          parcelName: session.metadata.parcelName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),

          trackingId: trackingId,
        };
        if (session.payment_status === "paid") {
          const paymrntresult = await paymentHistry.insertOne(paymentinfo);
          res.send({
            sucess: true,
            transactionId: session.payment_intent,
            trackingId: trackingId,

            modifyparcel: paymrntresult,
          });
        }

        // console.log(result);
      }
    });

    // payment get api----
    app.get("/paymenthistry", verifyFbToken, async (req, res) => {
      // console.log(req.headers);
      const email = req.query.email;
      const query = {};

      if (email) {
        query.customerEmail = email;

        // check fb  token verify email adderss--
        if (email !== req.decoded_email) {
          return res.status(403).send({ message: "forbiden access" });
        }
      }
      const cursor = paymentHistry.find(query).sort({
        paidAt: 1,
      });
      const result = await cursor.toArray();
      res.send(result);
    });

    // __________________END_________________________________

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
  } finally {
  }
}
run().catch(console.dir);
// ---------------------
app.get("/", (req, res) => {
  res.send("md nikel ali");
});

app.listen(port, () => {
  console.log(`this port is ${port}`);
});


