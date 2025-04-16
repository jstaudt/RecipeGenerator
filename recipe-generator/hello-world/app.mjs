import Knex from "knex";
import "dotenv/config.js";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: "us-east-1" });
const host = process.env.HOST;
const user = process.env.DB_USER;
const password = process.env.DB_PASS;
const recipient = process.env.RECIPIENT;
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
  let isReset = false;
  let randomRecipes = [];
  let remainderRecipes = [];
  let htmlString =
    '<!DOCTYPE html><html><body><div style="display:flex;justify-content:center;"><h2>Your Recipes for the Week</h2></div><ul style="list-style-type:decimal;">';

  /** gets 4 or less recipes at random from all recipes that have not been made
   * @param {number} limit - the number of recipes to return (<= 3)
   */
  const getNewRecipes = async (limit) => {
    let vegRecipe, vegRecipeHtml;

    // get recipes that haven't been made yet
    let recipes = await knex("recipeList")
      .where("hasBeenMade", "N")
      .whereNotIn("Name", randomRecipes);

    // get a veg recipe from the array
    vegRecipe = recipes.find((recipe) => recipe.vegetarian == "Y");
    vegRecipeHtml = vegRecipe
      ? `<li style="padding-bottom:15px;font-size:18px;">${vegRecipe.Name} (source: ${vegRecipe.source})</li>`
      : "";

    // get  random non-veg recipes from array
    recipes = recipes
      .filter((recipe) => recipe.vegetarian != "Y")
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map((item, index) => {
        if (item.source.includes("https")) {
          item.source = `<a href="${item.source}" target="_blank">Link to Recipe!</a>`;
        }
        htmlString += `<li style="padding-bottom:15px;font-size:18px;">${item.Name} (source: ${item.source})</li>`;

        return item.Name;
      });

    // only add a vegRecipe if we aren't getting a remainder (a list reset)
    if (vegRecipe && !isReset) {
      recipes.push(vegRecipe.Name);
      htmlString += vegRecipeHtml;
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

  // retrieve recipes from db and capture the count
  randomRecipes = await getNewRecipes(2);
  const randomRecipeCount = randomRecipes.length;

  // if there are less than 3 recipes retrieved
  if (randomRecipeCount < 3) {
    // update all records to hasBeenMade=N
    await knex("recipeList").update({
      hasBeenMade: "N",
    });

    // if there is at least 1 recipe retrieved, get remainder recipes, merge remainder and random recipes
    if (randomRecipeCount > 0) {
      isReset = true;
      const remainder = parseInt(3 - randomRecipeCount);
      remainderRecipes = await getNewRecipes(remainder);
      randomRecipes = randomRecipes.concat(remainderRecipes);
    } else {
      // if there are no recipes retrieved, get a fresh 3 and update them to hasBeenMade=Y
      randomRecipes = await getNewRecipes(2);
    }
  }

  // after all recipes have been stored in the array, update the db
  await updateRecipes();

  // concat closing tags of email body html
  htmlString += "</ul></body></html>";

  /**************************************Email functiionality**************************************************************** */
  // configure email notification
  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: [recipient],
    },
    Message: {
      Body: {
        Html: {
          Data: htmlString,
          Charset: "UTF-8",
        },
      },
      Subject: {
        Data: "Dinner Ideas for Next Week",
        Charset: "UTF-8",
      },
    },
    Source: "johnstaudt.sa@gmail.com",
  });

  // send email notification
  try {
    await sesClient.send(command);
  } catch (error) {
    console.log(`send email error ${JSON.stringify(error)}`);
  } finally {
    console.log("send email success");
  }

  const response = {
    statusCode: 200,
    body: {
      message: htmlString,
    },
  };

  return response;
};
