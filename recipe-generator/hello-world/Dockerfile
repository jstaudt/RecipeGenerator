FROM node:18-alpine
WORKDIR /recipe-generator
COPY . .
RUN yarn install --production
CMD ["node", "hello-world/app.mjs"]