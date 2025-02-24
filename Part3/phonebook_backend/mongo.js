const mongoose = require('mongoose')

if(process.argv.length<3){
  console.log('give password as argument')
  process.exit(1)
}

const password = process.argv[2]

const url = `mongodb+srv://fullstack2024:${password}@cluster0.ebtpy.mongodb.net/phonebook?retryWrites=true&w=majority`

mongoose.set('strictQuery', false)

mongoose.connect(url)

const phonebookSchema = new mongoose.Schema({
  name:{
    type:String,
    minLength:3,
    required:true,
  },
  number:String,
})

const Person = mongoose.model('persons', phonebookSchema)


if (process.argv.length < 4) {
  Person.find({}).then(result => {
    console.log('phonebook:')
    result.forEach(person => {
      console.log(person.name, person.number)
      mongoose.connection.close()
    })
  })
}else if (process.argv.length < 5){
  console.log('give name and number as argument')
  process.exit(1)
}else{
  const person = new Person({
    name: process.argv[3],
    number: process.argv[4]
  })

  person.save().then(() => {
    console.log(`added ${person.name} number ${person.number} to phonebook`)
    mongoose.connection.close()
  })
}


