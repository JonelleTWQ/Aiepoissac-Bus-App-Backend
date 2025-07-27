# Aiepoissac Bus App Backend

This was built with Node.js, Express, and MongoDB Atlas, then deployed on Render.

And YouTube videos. I'm really hoping it works. Do let me know if it doesn't!

URL:
https://aiepoissac-bus-app-backend.onrender.com/


# ========== (1) REGISTER A NEW USER ==========
POST /api/register

Body:
{
  "username": "user123",
  "password": "password123"
}

What it's supposed to do:
* If the username is new, it creates the account and returns: "You registered successfully!"
* If username already exists, then there will be an error.


# ========== (2) LOGIN ==========
POST /api/login

Body:
{
  "username": "user123",
  "password": "password123"
}

What it's supposed to do:
* If the password/user is incorrect, there will be an error.
* If login is successful, there will be a message 'Login successful!'.
Also, "userId" will be the user ID of this person.
Only use "userId" after login!


# ========== (3) SAVE FAVOURITE BUS STOP ==========
POST /api/preferences

Body:
{
  "userId": "user123",
  "favBusStop": "83139"
}

What it's supposed to do:
* Save a user's favourited bus stop.
(If I understand correctly, only one favourite is supported per user. If a user favourites a new stop, it replaces the old one.)


# ========== (4) GET FAVOURITE BUS STOP ==========
GET /api/preferences/:userId

What it's supposed to do:
* Get a user's favourite bus stop.


# ========== (5) SAVE A JOURNEY UNDER A PERSON ==========
POST /api/journeys

Body:
{
  "userId": "student123",
  "journeyID": "abc123",
  "description": "Home to NUS",
  "segments": [
    {
      "sequence": 1,
      "serviceNo": "151",
      "direction": 1,
      "originBusStopSequence": 12,
      "destinationBusStopSequence": 24
    },
    {
      "sequence": 2,
      "serviceNo": "95",
      "direction": 1,
      "originBusStopSequence": 5,
      "destinationBusStopSequence": 17
    }
  ]
}

What it's supposed to do:
* Save the journey under the person.

# ========== (5.1) Rename a journey and/or replace segments ==========
PATCH /api/journeys/:id
Body:
{
  "description": "Home to Work (fastest)",
  "segments": [
    {
      "sequence": 1,
      "serviceNo": "151",
      "direction": 1,
      "originBusStopSequence": 12,
      "destinationBusStopSequence": 24
    }
  ]
}

Note: :id here is the MongoDB _id, not journeyID.


# ========== (5.2) Replace only the segments ==========
PATCH /api/journeys/:id/segments

Body:
{
  "segments": [
    {
      "sequence": 1,
      "serviceNo": "95",
      "direction": 1,
      "originBusStopSequence": 5,
      "destinationBusStopSequence": 17
    },
    {
      "sequence": 2,
      "serviceNo": "151",
      "direction": 2,
      "originBusStopSequence": 20,
      "destinationBusStopSequence": 33
    }
  ]
}


# ========== (5.3) Get a journey (by journeyID) ==========
GET /api/journeys/by-journey-id/:journeyID


# ========== (5.4) Rename/replace (by journeyID) ==========
PATCH /api/journeys/by-journey-id/:journeyID


# ========== (5.5) Replace segments only (by journeyID) ==========
PATCH /api/journeys/by-journey-id/:journeyID/segments


# ========== (5.6) Delete a journey (by journeyID) ==========
DELETE /api/journeys/by-journey-id/:journeyID


# ========== (6) GET USER'S JOURNEYS ==========
GET /api/journeys/:userId

What it's supposed to do:
* Get all of this person's journeys.


# ========== (7) DELETE JOURNEY ==========
DELETE /api/journeys/:id

What it's supposed to do:
* Deletes a journey


# ========== (8) LTA STATIC DATA PROXIES ==========

These endpoints act as a "middleman" for the LTA DataMall API.  
The mobile app can call these instead of calling the LTA API directly.  
This way, the AccountKey remains safe in our backend, and the mobile app doesn't need to store it.

---

### 8.1 Get all bus stops  
GET /api/lta/bus-stops?skip=0

- Query parameter: `skip` (optional) – tells LTA how many records to skip (used for pagination).
- Example:  
  `https://aiepoissac-bus-app-backend.onrender.com/api/lta/bus-stops?skip=0`

---

### 8.2 Get all bus routes  
GET /api/lta/bus-routes?skip=0

- Query parameter: `skip` (optional).
- Example:  
  `https://aiepoissac-bus-app-backend.onrender.com/api/lta/bus-routes?skip=0`

---

### 8.3 Get all bus services  
**GET /api/lta/bus-services?skip=0**

- Query parameter: `skip` (optional).
- Example:  
  `https://aiepoissac-bus-app-backend.onrender.com/api/lta/bus-services?skip=0`



#
If anything breaks or doesn’t work, do let me know! :D

