# Crafter CMS Kubernetes Example Deployments

## Pre-requisites

1. Install kubectl
2. Have a Kubernetes cluster available. For testing the Simple Authoring and Simple Delivery you can used any cluster. If using `minikube`, please run the following commands, to avoid `context deadline exceeded` errors:

- `minikube image pull craftercms/authoring_tomcat:5.0.0-SNAPSHOT`
- `minikube image pull craftercms/authoring_tomcat:5.0.0E-SNAPSHOT`
- `minikube image pull craftercms/delivery_tomcat:5.0.0-SNAPSHOT`
- `minikube image pull craftercms/delivery_tomcat:5.0.0E-SNAPSHOT`
- `minikube image pull craftercms/deployer:5.0.0-SNAPSHOT`
- `minikube image pull craftercms/deployer:5.0.0E-SNAPSHOT`
- `minikube image pull opensearchproject/opensearch:3.9.0`

For the Authoring cluster example, you will need and AWS EKS cluster with the AWS Load Balancer Controller installed: https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html.

3. Create the `craftercms` namespace: `kubectl create namespace craftercms`

## Deployments

- [Authoring cluster (enterprise only)](authoring/cluster)
- [Simple Authoring with a single instance](authoring/simple)
- [Simple Delivery with 2 instances pulling from an Authoring cluster or a single Authoring](delivery/simple)