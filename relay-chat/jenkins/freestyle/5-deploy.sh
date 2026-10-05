docker rm -f relay-chat || true
docker run -d --name relay-chat --restart unless-stopped -p 3000:3000 $IMAGE:$BUILD_NUMBER
docker image prune -f
