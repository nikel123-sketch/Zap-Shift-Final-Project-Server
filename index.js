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

      
    //  app.post("/create-checkout-session", async (req,res)=>{
      
    //   const parcelinfo=req.body;
    //   const amount =parseInt(parcelinfo.cost)*100;
    //   const session = await stripe.checkout.sessions.create({
    //     line_items: [
    //       {
    //         price_data: {
    //           currency: "usd",
    //           unit_amount: amount,
    //           product_data: {
    //             name: parcelinfo.parcelName,
    //             description:
    //               "The products description, meant to be displayable to the customer",
    //           },
    //         },
    //         quantity: 1,
    //       },
    //     ],
    //     mode: "payment",
    //     customer_email: parcelinfo.SanderEmail,
    //     metadata: {
    //       parcelId: parcelinfo.parcelId,
    //     },
    //     success_url: `${process.env.SITE_DOMAIN}/dasbord/payment-success`,
    //     cancel_url: `${process.env.SITE_DOMAIN}/dasbord/payment-cancel`,
    //   });
    //   console.log(session)
    //   res.send({url:session.url})
    //  });

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
        metadata:{
          parcelId:parcelinfo.parcelId,
        },
        success_url: `${process.env.SITE_DOMAIN}/dasbord/payment-success`,
        cancel_url: `${process.env.SITE_DOMAIN}/dasbord/payment-cancel`,
      });

      console.log(session)
      res.send({url:session.url})
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
