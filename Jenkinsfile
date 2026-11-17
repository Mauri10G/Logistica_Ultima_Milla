// Pipeline de despliegue automatizado del Sistema de Gestion de Entregas y Rutas.
// Pruebas en contenedores -> imagenes Docker -> despliegue con Docker Compose -> prueba de humo -> Kubernetes opcional.
pipeline {
    agent any

    parameters {
        booleanParam(name: 'DESPLEGAR_K8S', defaultValue: true,
                     description: 'Desplegar tambien en el cluster de Kubernetes de Docker Desktop')
    }

    environment {
        TAG = "${env.BUILD_NUMBER}"
        COMPOSE = 'docker compose -f despliegue/docker-compose.yml -p logistica-prod'
    }

    options {
        timeout(time: 40, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Pruebas backend') {
            steps {
                // Corre ./mvnw test dentro de la etapa test del Dockerfile, con JDK 21.
                sh 'docker build --progress=plain --target test -t logistica-backend:test backend'
            }
        }

        stage('Pruebas web') {
            steps {
                // Corre ESLint y Jest dentro de la etapa test del Dockerfile, con Node 22.
                sh 'docker build --progress=plain --target test -t logistica-web:test web'
            }
        }

        stage('Construir imagenes Docker') {
            steps {
                sh 'docker build -t logistica-backend:$TAG -t logistica-backend:latest backend'
                sh 'docker build -t logistica-web:$TAG -t logistica-web:latest web'
                sh 'docker images | grep logistica-'
            }
        }

        stage('Desplegar con Docker Compose') {
            steps {
                sh '$COMPOSE up -d'
                sh '$COMPOSE ps'
            }
        }

        stage('Prueba de humo') {
            steps {
                // El backend tarda en arrancar porque Flyway crea el esquema, por eso se reintenta.
                sh '''
                    for i in $(seq 1 30); do
                      if docker exec logistica-prod-web wget -qO- http://localhost/api/servidor/hora; then
                        echo ""; echo "La aplicacion responde a traves de Nginx"; exit 0
                      fi
                      echo "Esperando al backend... intento $i"; sleep 5
                    done
                    docker logs --tail 50 logistica-prod-backend
                    exit 1
                '''
            }
        }

        stage('Desplegar en Kubernetes') {
            when { expression { params.DESPLEGAR_K8S } }
            steps {
                sh 'kubectl config use-context docker-desktop'
                sh 'kubectl apply -f k8s/00-namespace.yaml -f k8s/01-secret.yaml -f k8s/02-postgis.yaml'
                // Cada build despliega su propia etiqueta, asi Kubernetes hace un rolling update.
                sh 'sed "s/:latest/:$TAG/" k8s/03-backend.yaml | kubectl apply -f -'
                sh 'sed "s/:latest/:$TAG/" k8s/04-web.yaml | kubectl apply -f -'
                sh 'kubectl -n logistica rollout status deployment/backend --timeout=300s'
                sh 'kubectl -n logistica rollout status deployment/web --timeout=120s'
                sh 'kubectl -n logistica get pods,svc -o wide'
            }
        }
    }

    post {
        success {
            echo "Despliegue OK. Docker Compose: http://localhost:8081  Kubernetes: http://localhost:8082"
        }
        failure {
            echo 'El pipeline fallo. Revisar la etapa marcada en rojo.'
        }
    }
}
