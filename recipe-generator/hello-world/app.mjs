import Knex from "knex";
import "dotenv/config.js";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: "us-east-1" });
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
  let randomRecipes = [];
  let remainderRecipes = [];

  /** gets 4 or less recipes at random from all recipes that have not been made
   * @param {number} limit - the number of recipes to return (<= 4)
   */
  const getNewRecipes = async (limit) => {
    let vegRecipe;
    let recipes = await knex("recipeList")
      .where("hasBeenMade", "N")
      .whereNotIn("Name", randomRecipes);

    // get a veg recipe from the array
    vegRecipe = recipes.find((recipe) => recipe.vegetarian == "Y");
    vegRecipe = vegRecipe ? vegRecipe.Name : "";

    // if there is a veg recipe and the limit is 2, leave the limit as is, otherwise add 1
    limit = vegRecipe.length && limit == 2 ? limit : (limit += 1);

    // get non-veg recipes from array
    recipes = recipes
      .filter((recipe) => recipe.vegetarian != "Y")
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map((item, index) => {
        return item.Name;
      });

    // only add a vegRecipe if limit is 2, for a total of 3 recipes
    if (vegRecipe.length && limit == 2) {
      recipes.push(vegRecipe);
    }

    return recipes;
  };

  /** updates all recipes that are stored in randomRecipes array to hasBeenMade=Y
   */
  const updateRecipes = async () => {
    return await knex("recipeList").whereIn("Name", randomRecipes).update({
      hasBeenMade: "Y",
    });
  };

  randomRecipes = await getNewRecipes(2);
  const randomRecipeCount = randomRecipes.length;

  // if there are less than 4 recipes retrieved
  if (randomRecipeCount < 3) {
    // update all records to hasBeenMade=N
    await knex("recipeList").update({
      hasBeenMade: "N",
    });

    // if there is at least 1 recipe retrieved, get remainder recipes, merge remainder and random recipes, and update the 4 corresponding records to haveBeenMade=Y
    if (randomRecipeCount > 0) {
      remainderRecipes = await getNewRecipes(3 - randomRecipeCount);
      randomRecipes = randomRecipes.concat(remainderRecipes);
    } else {
      // if there are no recipes retrieved, get a fresh 4 and update them to hasBeenMade=Y
      randomRecipes = await getNewRecipes(2);
    }
  }

  await updateRecipes();

  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: ["charte@hfmsa.com"],
    },
    Message: {
      Body: {
        Text: {
          Data: JSON.stringify(randomRecipes),
          Charset: "UTF-8",
        },
      },
      Subject: {
        Data: "From Johnny: ",
        Charset: "UTF-8",
      },
    },
    Source: "johnstaudt.sa@gmail.com",
  });

  try {
    await sesClient.send(command);
  } catch (error) {
    console.log("send email error");
  } finally {
    console.log("send email success");
  }

  const response = {
    statusCode: 200,
    body: {
      message: randomRecipes,
    },
  };

  return response;
};
