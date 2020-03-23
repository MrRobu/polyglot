const MongoClient = require("mongodb").MongoClient;
const assert = require("assert");
const faker = require("faker");

// Database Name
const dbName = "polyglot";

const user = encodeURIComponent("root");
const password = encodeURIComponent("secret");

// Connection URL
const url = `mongodb://${user}:${password}@mongo`;

// Create a new MongoClient
const client = new MongoClient(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Use connect method to connect to the Server
client.connect(async err => {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  const db = client.db(dbName);

  try {
    // await init(db);

    // const genreNames = await db
    //   .collection("genres")
    //   .aggregate([{ $project: { name: 1 } }, { $limit: 1 }])
    //   .toArray()
    //   .then(genres => genres.map(g => g.name));

    // console.log(genreNames);

    // const res = await getBooksByGenreNames(db, genreNames);

    // const res = await getTheBooksWithAllItemsSold(db);

    // const res = await getTop5GreatestBookSells(db);

    // const res = await getBookItemsWhereCostsAreGreaterThen(db, 50);

    // console.log(res);
  } catch (e) {
    console.error(e);
  } finally {
    client.close();
  }
});

async function getBookItemsWhereCostsAreGreaterThen(db, cost) {
  return await db
    .collection("bookItems")
    .aggregate([
      {
        $lookup: {
          from: "restorations",
          localField: "_id",
          foreignField: "bookItemId",
          as: "restorations"
        }
      },
      {
        $unwind: "$restorations"
      },
      {
        $group: {
          _id: { _id: "$_id", price: "$price" },
          totalCost: { $sum: "$restorations.cost" }
        }
      },
      {
        $match: { totalCost: { $gt: cost } }
      }
    ])
    .toArray()
    .then(items => items.map(i => i._id._id));
}

async function getTop5GreatestBookSells(db) {
  return await db
    .collection("bookItems")
    .aggregate([
      {
        $group: {
          _id: "$bookId",
          total: { $sum: "$price" }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ])
    .toArray();
}

async function getTheBooksWithAllItemsSold(db) {
  return await db
    .collection("books")
    .aggregate([
      {
        $lookup: {
          from: "bookItems",
          localField: "_id",
          foreignField: "bookId",
          as: "items"
        }
      },
      {
        $match: {
          "items.dateOfPurchase": { $ne: null }
        }
      },
      {
        $sort: { title: 1 }
      }
    ])
    .toArray();
}

async function getBooksByGenreNames(db, genreNames) {
  return await db
    .collection("books")
    .aggregate([
      {
        $lookup: {
          from: "genres",
          localField: "genreIds",
          foreignField: "_id",
          as: "genres"
        }
      },
      {
        $match: {
          "genres.name": {
            $all: genreNames
          }
        }
      },
      { $sort: { name: 1 } }
    ])
    .toArray();
}

async function init(db) {
  try {
    // authors
    const authors = await db.createCollection("authors");
    await authors.deleteMany();
    const authorInserts = [];

    for (let i = 0; i <= 10; ++i) {
      authorInserts.push(fakeAuthor());
    }

    const authorIds = await authors
      .insertMany(authorInserts)
      .then(res => Object.values(res.insertedIds));

    // genres
    const genres = await db.createCollection("genres");
    await genres.deleteMany();
    const genreInserts = [];

    for (let i = 0; i <= 10; ++i) {
      genreInserts.push(fakeGenre());
    }

    const genreIds = await genres
      .insertMany(genreInserts)
      .then(res => Object.values(res.insertedIds));

    // books
    const books = await db.createCollection("books");
    await books.deleteMany();
    const bookInserts = [];

    for (let i = 0; i <= 30; ++i) {
      bookInserts.push(
        fakeBook({
          genreIds: shuffle(genreIds).slice(0, rand(0, 3))
        })
      );
    }
    const bookIds = await books
      .insertMany(bookInserts)
      .then(res => Object.values(res.insertedIds));

    // bookAuthor
    const bookAuthor = await db.createCollection("bookAuthor");
    await bookAuthor.deleteMany();
    const bookAuthorInserts = [];

    // bookItems
    const bookItems = await db.createCollection("bookItems");
    await bookItems.deleteMany();
    const bookItemInserts = [];

    // restorations
    const restorations = await db.createCollection("restorations");
    await restorations.deleteMany();
    const restorationInserts = [];

    // locationInLibrary
    const locationsInLibrary = await db.createCollection("locationsInLibrary");
    await locationsInLibrary.deleteMany();
    const locationInLibraryInserts = [];

    for (const bookId of bookIds) {
      for (let i = 0; i <= rand(1, 3); ++i) {
        bookAuthorInserts.push({
          authorNo: i + 1,
          bookId,
          authorId: faker.random.arrayElement(authorIds)
        });
      }
      for (let i = 0; i <= rand(5, 10); ++i) {
        const bookItem = fakeBookItem({
          bookId
        });
        bookItemInserts.push(bookItem);
      }
    }

    await bookAuthor.insertMany(bookAuthorInserts);
    const insertedBookItems = await bookItems
      .insertMany(bookItemInserts)
      .then(res => res.ops);

    for (const bookItem of insertedBookItems) {
      for (let i = 0; i <= rand(0, 3); ++i) {
        restorationInserts.push(
          fakeRestoration({
            bookItemId: bookItem._id
          })
        );
      }
      if (bookItem.availableToBorrow) {
        locationInLibraryInserts.push(
          fakeLocationInLibrary({
            bookItemId: bookItem._id
          })
        );
      }
    }
    await locationsInLibrary.insertMany(locationInLibraryInserts);
    await restorations.insertMany(restorationInserts);
  } catch (e) {
    console.log(e);
  }
}

const fakeAuthor = () => ({
  name: faker.name.findName(),
  description: faker.lorem.sentences(),
  contry: faker.address.country()
});

const fakeBook = data => ({
  ISBN: faker.random.number(),
  title: faker.name.title(),
  subject: faker.lorem.sentence(),
  language: faker.random.locale(),
  numberOfPages: rand(100, 500),
  publishDate: faker.date.past(2),
  ...data
});

const fakeGenre = () => ({
  name: faker.name.title(),
  description: faker.lorem.sentences()
});

const fakeBookItem = data => {
  const dateOfPurchase = faker.random.boolean() ? faker.date.past(1) : null;
  return {
    barcode: faker.random.number(),
    format: faker.random.arrayElement(bookItemFormats),
    price: Math.floor(Math.random() * 5000 + 10000) / 100,
    dateOfPurchase,
    status: faker.random.arrayElement(bookItemStatuses),
    condition: faker.random.arrayElement(bookItemConditions),
    availableToBorrow: !dateOfPurchase,
    ...data
  };
};
const bookItemFormats = ["pdf", "docx", "physical"];
const bookItemStatuses = ["purchased", "reserved", "pending"];
const bookItemConditions = ["good", "bad", "moderate"];

const fakeRestoration = data => ({
  type: faker.lorem.word(),
  reason: faker.lorem.sentence(),
  cost: Math.floor(Math.random() * 500 + 1000) / 100,
  restorationDate: faker.date.past(1),
  returnDate: faker.date.past(1),
  ...data
});

const fakeLocationInLibrary = data => ({
  room: rand(1, 5),
  rack: rand(1, 10),
  ...data
});

// Helpers
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  return items.sort(() => Math.random() - 0.5);
}
