# Get Started

## Get a Model Class

### 1. By database 

```
const FooBarDatabase = require('../models/FooBar');
let db = new FooBarDatabase('<connectionString>');
let User = db.model('User');
```

### 2. By app 

```
let User = app.model('fooBar.user');
```

## CRUD

### Query

```
// schema: fooBar
// entity: user
// entity: profile
// profile belongs to user
// a user may has many profile  

let User = app.model('fooBar.user');
User.findOne(/* id */ 1231, /* select */ { '*': true, 'profile.*': true, 'profile.gender.name': 'profile.gender' });
User.findAll(where, { select, groupBy, orderBy, limitOffset });

```
### Create

```
// schema: fooBar
// entity: user
// entity: profile
// profile belongs to user
// a user may has many profile  

let user = {
    username: 'guest',
    profiles: [ 
        {   
            source: 'facebook',
            firstName: 'Tom',
            lastName: 'Ham',            
        }   
    ]
};

let User = app.model('fooBar.user');

User.create(user);
// 1. insert profile
// 2. insert user

```

### Update

```
// schema: fooBar
// entity: user
// entity: profile
// profile belongs to user
// a user may has many profile  

let user = {
    id: 23131233,
    password: 'iefjeifj'
};

let User = app.model('fooBar.user');

User.updateOne(user);
// 1. begin transaction
// 2. select latest user by id
// 3. apply modification
// 4. update
// 5. commit

User.updateAll(modification, where);

```

### Delete

```
let User = app.model('fooBar.user');

User.deleteOne(id);
// 1. begin transaction
// 2. select latest user by id
// 3. if logical deletion, update isDeleted field
// 4. if not, delete
// 5. commit 

User.deleteAll(where);
// if logical deletion, call updateAll
// if not, delete all

```