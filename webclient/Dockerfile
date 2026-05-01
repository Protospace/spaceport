FROM node:14-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000

ENV HOST=0.0.0.0
ENV CI=false
ENV BROWSER=none

CMD ["yarn", "start"]
