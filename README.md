# Relay Chat: Jenkins + Docker CI/CD

Real-time chat app (Express + Socket.IO) built, tested, pushed and deployed by Jenkins.

## Project layout
```
relay-chat/
├── server.js                 # Express + Socket.IO server (/health, /metrics)
├── public/index.html         # chat UI
├── test/server.test.js       # unit tests (node:test)
├── package.json
├── Dockerfile                # multi-stage: deps -> test -> prod-deps -> runtime (non-root)
├── Jenkinsfile               # declarative pipeline
├── docker-compose.yml        # run the deployed image
├── .dockerignore / .gitignore
└── jenkins/
    ├── Dockerfile.jenkins            # Jenkins + Docker CLI
    ├── docker-compose.jenkins.yml    # run Jenkins (compose)
    ├── run-jenkins.sh                # run Jenkins (plain docker, prints unlock password)
    └── freestyle/                    # shell steps for the Freestyle job
```

## 1. Run locally
```bash
npm install
npm test
npm start            # http://localhost:3000 (open in two tabs)
```

## 2. Run Jenkins
Either use the helper script:
```bash
./jenkins/run-jenkins.sh
```
or compose:
```bash
cd jenkins
docker compose -f docker-compose.jenkins.yml up -d --build
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
Open http://localhost:8080, install suggested plugins, then install **Docker Pipeline**.

## 3. Add credentials
Manage Jenkins -> Credentials -> Global -> Add:
- Kind: Username with password
- Username: Docker Hub username
- Password: Docker Hub access token
- ID: `dockerhub-creds`

## 4a. Freestyle job (learning step)
- New Item -> Freestyle project
- String parameter `IMAGE` = `yourdockerhubuser/relay-chat`
- Git repo, branch `*/main`
- Build Environment -> Use secret text(s) or file(s) -> Username and password (separated):
  `DOCKER_USER` / `DOCKER_PASS` using `dockerhub-creds`
- Add five "Execute shell" steps, pasting `jenkins/freestyle/1..5-*.sh` in order
- Trigger: Poll SCM `H/2 * * * *`

## 4b. Pipeline job
- New Item -> Pipeline -> Pipeline script from SCM
- Git repo, branch `*/main`, Script Path `Jenkinsfile`
- Edit `IMAGE` in the Jenkinsfile first
- Disable the Freestyle job (both deploy to port 3000)

## 5. Verify
```bash
curl http://localhost:3000/health
docker exec relay-chat whoami      # node (non-root)
```
Check Docker Hub for both tags (`latest` and the build number).

## Stages
Checkout -> Unit Tests -> Build -> Smoke Test -> Push -> Deploy -> Cleanup.
A failed test or health check stops the pipeline before anything is pushed.
