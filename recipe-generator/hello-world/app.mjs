import Knex from "knex";
import "dotenv/config.js";

const host = process.env.HOST;
const user = process.env.DB_USER;
const password = process.env.DB_PASS;
const database = "recipeapp";
const connection = {
  ssl: { rejectUnauthorized: false },
  host,
  user,
  password,
  database,
};

const knex = Knex({
  client: "mysql",
  connection,
});

export const lambdaHandler = async (event, context) => {
  const recipes = await knex.select().table("recipeList");
  const response = {
    statusCode: 200,
    body: {
      message: recipes,
    },
  };

  return response;
};
