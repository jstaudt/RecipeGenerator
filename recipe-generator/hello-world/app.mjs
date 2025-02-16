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
  let remainderRecipes = [];
  let updated = [];

  const getNewRecipes = async (limit) => {
    const recipes = await knex("recipeList").where("hasBeenMade", "N");

    return recipes
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map((item, index) => {
        return item.Name;
      });
  };

  const updateRecipes = async () => {
    updated = await knex("recipeList").whereIn("Name", randomRecipes).update({
      hasBeenMade: "Y",
    });

    return updated;
  };

  let randomRecipes = await getNewRecipes(4);
  const randomRecipeCount = randomRecipes.length;

  // if there are less than 4 recipes retrieved
  if (randomRecipeCount < 4) {
    // update all records to hasBeenMade=N
    await knex("recipeList").update({
      hasBeenMade: "N",
    });

    // if there is at least 1 recipe retrieved, get remainder recipes and merge arrays
    if (randomRecipeCount > 0) {
      remainderRecipes = await getNewRecipes(4 - randomRecipeCount);
      randomRecipes = randomRecipes.concat(remainderRecipes);

      await updateRecipes(randomRecipes);
    } else {
      // if there are no recipes retrieved, get a fresh 4 and update them to hasBeenMade=Y
      randomRecipes = await getNewRecipes(4);

      await updateRecipes(randomRecipes);
    }
  } else {
    // if all 4 recipes are retrieved, update those 4 recipes to hasBeenMade=Y
    await updateRecipes(randomRecipes);
  }

  const response = {
    statusCode: 200,
    body: {
      message: randomRecipes,
    },
  };

  return response;
};
