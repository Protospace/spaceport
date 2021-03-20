docker build . -t spaceport-client
docker run -v $PWD:/usr/src/app spaceport-client
# npm install
# npm run start