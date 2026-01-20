// ------------dotenv---------
require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

// stripe---
const stripe = require("stripe")(process.env.DB_STRIPE);


// madilware---
app.use(express.json());
app.use(cors());



// traking id ---
const crypto=require('crypto');
function generateTrackingId(){
  const prefix='PRCL';
  const date=new Date().toISOString().slice(0,10).replace(/-/g,'');
  const random=crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${date}-${random}`
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
    await client.connect();

    // db----
    const db=client.db('Zap_Shift_Final_Project_DB')
    const parcelscoll=db.collection('parcels')
    const paymentHistry=db.collection('paymenthistry')
    
    // all api here-----

    // parcels get api---
    app.get('/parcels', async(req,res)=>{
      const query={};
      const {email}=req.query;
      if(email){
        query.SanderEmail = email;
      }
      const cursor=parcelscoll.find(query);
      const result=await cursor.toArray();
      res.send(result)
    })
    
    // parcels post api--
    app.post('/parcels', async(req,res)=>{
      const parcel=req.body;
      parcel.createdAt=new Date();
      const result =await parcelscoll.insertOne(parcel);
      res.send(result)
    })

    // parcel delete api---
    app.delete('/parcels/:id',async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
     
        const result = await parcelscoll.deleteOne(query);
        res.send(result);
      
       })

      //  pay parcel get api---
      app.get('/parcels/:id', async(req,res)=>{
        const id=req.params.id;
        const query={_id:new ObjectId(id)}
        const result =await parcelscoll.findOne(query);
        res.send(result)
      })


      

      // payment stripe post api----

    app.post("/create-checkout-session",async(req,res)=>{
      const parcelinfo=req.body;
      const amount=parseInt(parcelinfo.cost)*100;
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

      console.log(session)
      res.send({url:session.url})
    });


    // payment pacth check and api--
    app.patch('/paymentSuccess',async(req,res)=>{
      const sessionId=req.query.session_id;
    
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // ----
      const transactionId=session.payment_intent;
      const query={transactionId:transactionId}
      const paymentExist=await paymentHistry.findOne(query);
      console.log(paymentExist)
      if (paymentExist) {
        return res.send({
          message: "already exist",
          transactionId,
          trackingId: paymentExist.trackingId,
        });
      }

      if(session.payment_status==='paid'){
        const id =session.metadata.parcelId;
        const trackingId = generateTrackingId();
        const query={_id:new ObjectId(id)}
        const update = {
          $set: {
            paymentStatus: "paid",
            trackingId: trackingId,
          },
        };
        const result =await parcelscoll.updateOne(query,update)

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
        if(session.payment_status==='paid'){
          const paymrntresult = await paymentHistry.insertOne(paymentinfo)
          res.send({
            sucess: true,
            transactionId: session.payment_intent,
            trackingId: trackingId,
            modifyparcel: paymrntresult,
          });
        }
       
        console.log(result)
      }
      
    })

   
    // payment relate api ----
    app.get("/paymenthistry" ,async (req,res)=>{
      const email=req.query.email;
      const query={}
      if(email){
        query.customerEmail=email
      }
      const cursor=paymentHistry.find(query);
      const result=await cursor.toArray();
      res.send(result)
    });


    
    

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
