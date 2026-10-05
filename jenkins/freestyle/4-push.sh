# Needs credentials binding: DOCKER_USER / DOCKER_PASS (from dockerhub-creds)
echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
docker push $IMAGE:$BUILD_NUMBER
docker push $IMAGE:latest
docker logout
