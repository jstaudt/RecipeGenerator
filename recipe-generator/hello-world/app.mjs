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
    const recipes = await knex("recipeList")
      .where("hasBeenMade", "N")
      .whereNotIn("Name", randomRecipes);

    return recipes
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map((item, index) => {
        return item.Name;
      });
  };

  /** updates all recipes that are stored in randomRecipes array to hasBeenMade=Y
   */
  const updateRecipes = async () => {
    return await knex("recipeList").whereIn("Name", randomRecipes).update({
      hasBeenMade: "Y",
    });
  };

  randomRecipes = await getNewRecipes(4);
  const randomRecipeCount = randomRecipes.length;

  // if there are less than 4 recipes retrieved
  if (randomRecipeCount < 4) {
    // update all records to hasBeenMade=N
    await knex("recipeList").update({
      hasBeenMade: "N",
    });

    // if there is at least 1 recipe retrieved, get remainder recipes, merge remainder and random recipes, and update the 4 corresponding records to haveBeenMade=Y
    if (randomRecipeCount > 0) {
      remainderRecipes = await getNewRecipes(4 - randomRecipeCount);
      randomRecipes = randomRecipes.concat(remainderRecipes);

      await updateRecipes();
    } else {
      // if there are no recipes retrieved, get a fresh 4 and update them to hasBeenMade=Y
      randomRecipes = await getNewRecipes(4);

      await updateRecipes();
    }
  } else {
    // if all 4 recipes are retrieved, update those 4 recipes to hasBeenMade=Y
    await updateRecipes();
  }

  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: ["johnstaudt.sa@gmail.com"],
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
