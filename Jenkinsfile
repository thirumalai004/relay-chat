// For Jenkins installed directly on Windows (uses bat instead of sh)
pipeline {
    agent any
    environment {
        IMAGE = "thirudocker004/taskboard"
        CREDS = credentials('dockerhub-creds')
    }
    options { timestamps() }
    stages {
        stage('Checkout') { steps { checkout scm } }
        stage('Unit Tests') {
            steps { bat 'docker build --target test -t %IMAGE%:test-%BUILD_NUMBER% .' }
        }
        stage('Build') {
            steps { bat 'docker build -t %IMAGE%:%BUILD_NUMBER% -t %IMAGE%:latest .' }
        }
        stage('Smoke Test') {
            steps {
                bat '''
                    docker rm -f smoke-%BUILD_NUMBER% >nul 2>&1
                    docker run -d --name smoke-%BUILD_NUMBER% %IMAGE%:%BUILD_NUMBER%
                    if errorlevel 1 exit /b 1
                    set /a TRIES=0
                    :retry
                    docker exec smoke-%BUILD_NUMBER% wget -q --spider http://localhost:3000/health
                    if not errorlevel 1 exit /b 0
                    set /a TRIES+=1
                    if %TRIES% GEQ 10 goto fail
                    ping -n 3 127.0.0.1 >nul
                    goto retry
                    :fail
                    docker logs smoke-%BUILD_NUMBER%
                    exit /b 1
                '''
            }
            post { always { bat returnStatus: true, script: 'docker rm -f smoke-%BUILD_NUMBER%' } }
        }
        stage('Push') {
            steps {
                bat '''
                    echo %CREDS_PSW%| docker login -u %CREDS_USR% --password-stdin
                    if errorlevel 1 exit /b 1
                    docker push --quiet %IMAGE%:%BUILD_NUMBER%
                    if errorlevel 1 exit /b 1
                    docker push --quiet %IMAGE%:latest
                '''
            }
        }
        stage('Deploy') {
            steps {
                bat '''
                    docker rm -f taskboard >nul 2>&1
                    docker run -d --name taskboard --restart unless-stopped -p 3001:3000 -v taskboard-data:/data %IMAGE%:%BUILD_NUMBER%
                '''
            }
        }
    }
    post {
        always  { bat returnStatus: true, script: 'docker logout & docker image prune -f' }
        success { echo "TaskBoard build #${env.BUILD_NUMBER} deployed on port 3001" }
        failure { echo "Build #${env.BUILD_NUMBER} failed" }
    }
}