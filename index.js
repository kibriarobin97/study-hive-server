const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174'
    ],
    credentials: true,
    optionSuccessStatus: 200,
  }
app.use(cors(corsOptions));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mahb0di.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const reviewsCollection = client.db('studyHiveDB').collection('reviews')
    const userCollection = client.db('studyHiveDB').collection('users')
    const classesCollection = client.db('studyHiveDB').collection('classes')



    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1hr'})
      res.send({token})
    })

    //middleware verify token
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization)
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
      })
    }

    // const verifyAdmin = async(req, res, next) => {
    //   const email = req.decoded.email;
    //   const query = {email: email}
    //   const user = await userCollection.findOne(query)
    //   const isAdmin = user?.role === "admin"
    //   if(!isAdmin){
    //     res.status(403).send({message: 'forbidden access'})
    //   }
    //   next()
    // }


    // users api
    app.get('/users', async(req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })

    // app.post('/users', async(req, res) => {
    //   const user = req.body;
    //   const query = {email: user.email}
    //   const isExist = await userCollection.findOne(query)
    //   if(isExist){
    //     return res.send({insertedId: null})
    //   }
    //   const result = await userCollection.insertOne(user);
    //   res.send(result)
    // })

    app.put('/user', async (req, res) => {
      const user = req.body
      const query = { email: user?.email }
      const isExist = await userCollection.findOne(query)
      if (isExist) {
        return res.send(isExist)
      }

      // save user for the first time
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user
        },
      }
      const result = await userCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })

    // review api
    app.get('/reviews', async(req, res) => {
      const result = await reviewsCollection.find().toArray()
      res.send(result)
  })

  // class api
  app.post('/classes', async(req, res) => {
    const classData = req.body;
    const result = await classesCollection.insertOne(classData)
    res.send(result)
  })

  app.get('/all-classes', async(req, res) => {
    const result = await classesCollection.find().toArray()
    res.send(result)
  })

  app.get('/classes/:id', async(req, res) => {
    const id = req.params.id
    const query = { _id: new ObjectId(id) }
    const result = await classesCollection.findOne(query)
    res.send(result)
  })

  app.get('/my-classes/:email', verifyToken, async(req, res) => {
    const email = req.params.email;
    const query = {teacher_email: email}
    if(email !== req.decoded.email){
      return res.status(403).send({message: 'forbidden access'})
    }
    const result = await classesCollection.find(query).toArray()
    res.send(result)
  })

  app.delete('/my-classes/:id', async(req, res) => {
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await classesCollection.deleteOne(query)
    res.send(result)
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




app.get('/', (req,res) => {
    res.send('study hive is running')
})

app.listen(port, () => {
    console.log(`study hive is running on port: ${port}`)
})