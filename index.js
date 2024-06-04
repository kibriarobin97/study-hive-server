const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRETE_KEY);
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
    const applyTeachCollection = client.db('studyHiveDB').collection('applyTeach')
    const enrollClassCollection = client.db('studyHiveDB').collection('enrollClass')



    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1hr'})
      res.send({token})
    })

    //middleware verify token
    const verifyToken = (req, res, next) => {
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

    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === "admin"
      if(!isAdmin){
        res.status(403).send({message: 'forbidden access'})
      }
      next()
    }

    // users api
    app.get('/users', async(req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })

    app.get('/user/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email: email}
      const result = await userCollection.findOne(query)
      res.send(result)
    })

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

    app.patch('/users/admin/:id', verifyToken, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          role: 'Admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/users/:id', verifyToken, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    // apply for teacher
    app.post('/apply-teach', async(req, res) => {
      const teacherData = req.body;
      const result = await applyTeachCollection.insertOne(teacherData)
      res.send(result)
    })

    app.put('/apply-teach',verifyToken, async(req, res) => {
      const user = req.body;
      const query = { email: user?.email }
      const options = {upsert: true}
      const updateDoc = {
        $set: {
          ...user
        },
      }
      const result = await applyTeachCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })

    app.get('/apply-teach', async(req, res) => {
      const result = await applyTeachCollection.find().toArray()
      res.send(result)
    })

    app.patch('/apply-teach/:id/:teacherEmail', verifyToken, async(req, res) => {
      const id = req.params.id;
      const email = req.params.teacherEmail;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          role: 'Teacher',
          status: 'Accepted'
        }
      }
      const result = await applyTeachCollection.updateOne(filter, updatedDoc)

      const query = {email: email}
      const updatedRole = {
        $set: {
          role: 'Teacher',
          status: 'Accepted'
        }
      }
      const userRole = await userCollection.updateOne(query, updatedRole)

      res.send({result, userRole})
    })

    app.patch('/reject-teach/:id/:teacherEmail', verifyToken, async(req, res) => {
      const id = req.params.id;
      const email = req.params.teacherEmail;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          status: 'Rejected'
        }
      }
      const result = await applyTeachCollection.updateOne(filter, updatedDoc)
      const query = {email: email}
      const updatedRole = {
        $set: {
          status: 'Rejected'
        }
      }
      const userRole = await userCollection.updateOne(query, updatedRole)

      res.send({result, userRole})
    })

    // review api
    app.get('/reviews', async(req, res) => {
      const result = await reviewsCollection.find().toArray()
      res.send(result)
  })

  // classes api
  app.post('/classes', async(req, res) => {
    const classData = req.body;
    const result = await classesCollection.insertOne(classData)
    res.send(result)
  })

  app.get('/all-classes/accepted', async(req, res) => {
    const result = await classesCollection.find({status: 'Accepted'}).toArray()
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

  app.get('/classes-update/:id', async(req, res) => {
    const id = req.params.id
    const query = { _id: new ObjectId(id) }
    const result = await classesCollection.findOne(query)
    res.send(result)
  })

  app.patch('/update-classes/:id', verifyToken, async(req, res) => {
    const id = req.params.id;
    const classesData = req.body;
    const query = {_id: new ObjectId(id)}
    const updateDoc = {
      $set: {
        ...classesData
      }
    }
    const result = await classesCollection.updateOne(query, updateDoc)
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

  app.patch('/classes-accept/:id', async (req, res) => {
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}
    const updatedDoc = {
      $set: {
        status: 'Accepted'
      }
    }
    const result = await classesCollection.updateOne(filter, updatedDoc)
    res.send(result)
  })

  app.patch('/classes-reject/:id', async (req, res) => {
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}
    const updatedDoc = {
      $set: {
        status: 'Rejected'
      }
    }
    const result = await classesCollection.updateOne(filter, updatedDoc)
    res.send(result)
  })

  app.get('/teacher-stat/:id', async(req, res) => {
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const enrollClass = await classesCollection.findOne(query)
    res.send(enrollClass)
  })

  // payment api
  app.post('/create-payment-intent', async(req, res) => {
    const {price} = req.body;
    const amount = parseInt(price * 100)
    console.log(amount)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      payment_method_types: ['card']
    })

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  })
  
  // enroll class api
  app.put('/enroll-class/:id', async(req, res) => {
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const enrollData = req.body;
    const result = await enrollClassCollection.insertOne(enrollData)
    const updatedDoc = {
      $inc: {
        enrolment: +1
      }
    }
    const updateResult = await classesCollection.updateOne(query, updatedDoc)
    res.send({result, updateResult})
  })

  app.get('/my-enroll-class/:email', async(req, res) => {
    const email = req.params.email;
    const query = {email: email}
    const result = await enrollClassCollection.find(query).toArray()
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