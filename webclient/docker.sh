docker build . -t spaceport-client
docker run -it -p 3000:3000 -v $PWD/src:/usr/src/app/src spaceport-client
# npm install
# npm run start