const { test, after, beforeEach, describe } = require('node:test')
const mongoose = require('mongoose')
const supertest = require('supertest')
const app = require('../app')
const assert = require('node:assert')
const Blog = require('../models/blog')
const helper = require('./test_helper')
const bcrypt = require('bcrypt')
const User = require('../models/user')

const api = supertest(app)

let token = null
beforeEach(async () => {
    token = await helper.getAuthToken()
    await Blog.deleteMany({})
    await Blog.insertMany(helper.intialBlogs)
})

describe('when there is initially one user in db', () => {
    beforeEach(async () => {
        await User.deleteMany({})

        const passwordHash = await bcrypt.hash('sanchit', 8)

        const user = new User({username: 'root', passwordHash})

        await user.save()
    })

    test('creation succeds with a fresh username', async() => {
        const userAtStart = await helper.usersInDb()

        const newUser = {
            username: 'sanchit33',
            name: 'sanchit',
            password: 'sanchit'
        }

        await api
        .post('/api/users')
        .send(newUser)
        .expect(201)
        .expect('Content-Type', /application\/json/)

        const userAtEnd = await helper.usersInDb()
        assert.strictEqual(userAtEnd.length, userAtStart.length + 1)

        const usernames = userAtEnd.map(u => u.username)
        assert(usernames.includes(newUser.username))

    })
    
    test('creation fails with proper statuscode and message if username already taken', async () => {
        const usersAtStart = await helper.usersInDb()
        
        const newUser = {
            username:'root',
            name:'Superuser',
            password:'Sanchit'
        }

        const result = await api
        .post('/api/users')
        .send(newUser)
        .expect(400)
        .expect('Content-Type', /application\/json/)

        const userAtEnd = await helper.usersInDb()

        assert.strictEqual(userAtEnd.length, usersAtStart.length)
        assert(result.body.error.includes("expected `username` to be unique"))

    })

    test('creation fails with proper statuscode and message if username is less than 3 characters', async () => {
        const usersAtStart = await helper.usersInDb()

        const newUser = {
            username: 'ro',
            name: 'sanchit',
            password: 'sanchit'
        }

        const result = await api
        .post('/api/users')
        .send(newUser)
        .expect(400)
        .expect('Content-Type', /application\/json/)

        const usersAtEnd = await helper.usersInDb()

        assert.strictEqual(usersAtEnd.length, usersAtStart.length)
        assert(result.body.error.includes('User validation failed: username: Path `username` (`ro`) is shorter than the minimum allowed length (3).'), true)

    })

    test('creation fails with proper statuscode and message if password is less than 3 characters', async () => {
        const usersAtStart = await helper.usersInDb()

        const newUser = {
            username: 'root 5',
            name: 'sanchit',
            password: 'sa'
        }
        
        const result = await api
        .post('/api/users')
        .send(newUser)
        .expect(400)
        .expect('Content-Type', /application\/json/)

        const usersAtEnd = await helper.usersInDb()

        assert.strictEqual(usersAtEnd.length, usersAtStart.length)
        assert(result.body.error.includes('password must be long'), true)
    })
})

describe('when there are initially some notes saved', () => {

    test('blogs are retured as json', async () => {
        await api
            .get('/api/blogs')
            .expect(200)
            .expect('Content-Type', /application\/json/)
    })

    test('all blogs are retured', async () => {
        const res = await api.get('/api/blogs')

        assert.strictEqual(res.body.length, helper.intialBlogs.length)
    })

    test('the first blog is about React patterns', async () => {
        const res = await api.get('/api/blogs')

        const contents = res.body.map(e => e.title)

        assert(contents.includes('React patterns'), true)
    })

    describe('addition of new blog', () => {
        
        test('valid blog can be added', async () => {
            const newBlog = {
                title: "React Native Pattern",
                author: "Sanchit Shinde",
                url: "https://reactpatterns.com/",
                likes: 3,
            }

            await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(201)
                .expect('Content-Type', /application\/json/)

            const res = await helper.blogsInDb()

            const contents = res.map(blog => blog.title)

            assert.strictEqual(res.length, helper.intialBlogs.length + 1)
            assert(contents.includes('React Native Pattern'), true)

        })

        test('if like is not given than it should return 0', async () => {
            const newBlog = {
                title: "React Native Pattern",
                author: "Sanchit Shinde",
                url: "https://reactpatterns.com/",
            }

            await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(201)
                .expect('Content-Type', /application\/json/)

            const res = await helper.blogsInDb()
            const recentBlog = res[helper.intialBlogs.length]

            assert(recentBlog.likes === 0, true)
        })

        test('blog without title is not added', async () => {
            const newBlog = {
                author: "Sanchit Shinde",
                url: "www.https//sanchitblogs.com",
                likes: 3,
            }

            await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(400)

            const res = await helper.blogsInDb()

            assert(res.length === helper.intialBlogs.length, true)

        })

        test('blog without url is not added', async () => {
            const newBlog = {
                title: "Type-Script",
                author: "Sanchit Shinde",
                likes: 3,
            }

            await api
                .post('/api/blogs')
                .set('Authorization', `Bearer ${token}`)
                .send(newBlog)
                .expect(400)

            const res = await helper.blogsInDb()

            assert(res.length === helper.intialBlogs.length, true)
        })

        test('blog without authorization is not added', async () => {
            const newBlog = {
                title: "something root 2",
                url: "http://something.com",
                author: "sanchit",
                likes: 1
            }

            const res = await api
            .post('/api/blogs')
            .send(newBlog)
            .expect(401)

            const blogsAtEnd = await helper.blogsInDb()
            assert.strictEqual(blogsAtEnd.length, helper.intialBlogs.length)

            const content = blogsAtEnd.map(item => item.title)
            assert.strictEqual(!content.includes(newBlog.title), true)

            assert.strictEqual(res.body.error, 'token invalid')
        })
    })

    describe('deletion of a blog', () => {

        test('succeeds with status code 204 if id is valid', async () => {
            const newBlog = {
                title: "something root 2",
                author: "sanchit",
                url: "something",
                likes: 1
            }
            const blogToDelete = await api.post('/api/blogs').set('Authorization', `Bearer ${token}`).send(newBlog)
              
              

            await api
                .delete(`/api/blogs/${blogToDelete.body.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(204)

            const blogsAtEnd = await helper.blogsInDb()
            const content = blogsAtEnd.map(item => item.title)

            assert.strictEqual(blogsAtEnd.length, helper.intialBlogs.length);
            assert.strictEqual(!content.includes(newBlog.title), true)

        })
    })

    describe('updating the blog', () => {
        test('updating the information of an individual blog', async () => {
            const blogs = await helper.blogsInDb()
            const blogToUpdate = blogs[0]

            const updatedBlog = {
                ...blogToUpdate,
                likes: blogToUpdate.likes + 1
            }

            await api
            .put(`/api/blogs/${blogToUpdate.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updatedBlog)
            .expect(200)

            const blogAfterUpdate = await helper.blogsInDb()
            console.log(updatedBlog)
            console.log(blogAfterUpdate[0])

            assert.strictEqual(blogAfterUpdate[0].likes, updatedBlog.likes)
        })
    })
})


test('the blog post has unique identifier property named as id', async () => {
    const res = await api.get('/api/blogs')

    assert("id" in res.body[0], true)
})




after(async () => {
    await mongoose.connection.close()
})