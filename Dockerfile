FROM node:20-alpine

WORKDIR /app

COPY ./package.json /app
COPY ./yarn.lock /app

RUN yarn install && yarn cache clean

COPY . ./

CMD ["yarn", "start:build"]