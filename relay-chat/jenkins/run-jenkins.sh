#!/usr/bin/env bash
# Builds and starts Jenkins with access to the host's Docker.
set -e
cd "$(dirname "$0")"
docker build -t jenkins-docker -f Dockerfile.jenkins .
docker rm -f jenkins 2>/dev/null || true
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -u root \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins-docker
echo "Waiting for Jenkins to start..."
sleep 20
echo "Unlock password:"
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
echo "Open http://localhost:8080"
