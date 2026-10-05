trap 'docker rm -f smoke-$BUILD_NUMBER' EXIT
docker run -d --name smoke-$BUILD_NUMBER $IMAGE:$BUILD_NUMBER
for i in 1 2 3 4 5 6 7 8 9 10; do
  docker exec smoke-$BUILD_NUMBER wget -q --spider http://localhost:3000/health && exit 0
  sleep 2
done
echo "Health check failed"
docker logs smoke-$BUILD_NUMBER
exit 1
