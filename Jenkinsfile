pipeline {
    agent any
    environment {
        IMAGE = "yourdockerhubuser/relay-chat"   // <-- change this
        CREDS = credentials('dockerhub-creds')
    }
    options { timestamps() }
    stages {
        stage('Checkout') {
            steps { checkout scm }
        }
        stage('Unit Tests') {
            // Runs `npm test` inside the Dockerfile's "test" stage
            steps { sh 'docker build --target test -t $IMAGE:test-$BUILD_NUMBER .' }
        }
        stage('Build') {
            steps { sh 'docker build -t $IMAGE:$BUILD_NUMBER -t $IMAGE:latest .' }
        }
        stage('Smoke Test') {
            steps {
                sh '''
                  docker run -d --name smoke-$BUILD_NUMBER $IMAGE:$BUILD_NUMBER
                  for i in 1 2 3 4 5 6 7 8 9 10; do
                    docker exec smoke-$BUILD_NUMBER wget -q --spider http://localhost:3000/health && exit 0
                    sleep 2
                  done
                  echo "Health check failed"; docker logs smoke-$BUILD_NUMBER; exit 1
                '''
            }
            post { always { sh 'docker rm -f smoke-$BUILD_NUMBER || true' } }
        }
        stage('Push') {
            steps {
                sh '''
                  echo "$CREDS_PSW" | docker login -u "$CREDS_USR" --password-stdin
                  docker push $IMAGE:$BUILD_NUMBER
                  docker push $IMAGE:latest
                '''
            }
        }
        stage('Deploy') {
            steps {
                sh '''
                  docker rm -f relay-chat || true
                  docker run -d --name relay-chat --restart unless-stopped -p 3000:3000 $IMAGE:$BUILD_NUMBER
                '''
            }
        }
    }
    post {
        always  { sh 'docker logout || true; docker image prune -f' }
        success { echo "Relay chat build #${env.BUILD_NUMBER} deployed on port 3000" }
        failure { echo "Build #${env.BUILD_NUMBER} failed" }
    }
}
