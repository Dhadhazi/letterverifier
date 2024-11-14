# Deployment Guide

## Lambda Function Deployment

### Prepare Lambda Code

1. Run `npm i` in the backend-lambda folder
2. ZIP the function ccode and node modules

### Create Lambda Function in AWS Console

1. Go to AWS Lambda Console
2. Click "Create function"
3. Select "Author from scratch"
4. Configure basic settings:
   - Function name: your-function-name
   - Runtime: Node.js 18.x
   - Architecture: x86_64
   - Permissions: Create a new role with basic Lambda permissions

### Configure Lambda Function

1. Upload the ZIP file in the "Code source" section
2. Configure environment variables:
   - API_KEY - Sets the API key the frontend needs to submit
   - OPENAI_API_KEY - The API key from OpenAI
   - (optional) GPT_MODEL - Default is gpt-4o-mini
   - (optional) DAILY_LIMIT - The number of messages a user can send, default is 5
   - (optional) MAX_WORDS - Number of words a message can be, default is 350
3. Adujust the Timeout to 20 seconds in Configuration/General configuration

## DynamoDB Setup

1. Go to DynamoDB Console
2. Create a new table:
   - Table name: letter_verifier
   - Partition key: userId (String)
   - Sort key: date (String)
3. Note down the table ARN

## IAM Role Configuration

1. Go to the IAM Console
2. Find the role created for your Lambda function
3. Add the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:UpdateItem"],
      "Resource": "YOUR-DYNAMODB-TABLE-ARN"
    }
  ]
}
```

## API Gateway Setup

### Create API

1. Go to API Gateway Console
2. Click "Create API"
3. Choose "REST API" (not private)
4. Click "Build"
   - API name: letter-verifier-api
   - Endpoint Type: Regional

### Create Resource and Method

1. "Create Resource"

   - Resource Name: api
   - Create another resource under /api:
   - Resource Name: process-letter

2. Create POST method:
   - Under the process-letter resource "Create Method"
   - Select POST
   - Integration type: Lambda Function
   - Lambda Function: Select your function
   - Use Lambda Proxy integration: Yes

### Configure CORS

1. Select the resource /api/process-letter
2. "Enable CORS"
3. Configure CORS settings:
   - Access-Control-Allow-Methods: 'OPTIONS,POST'
   - Access-Control-Allow-Headers: 'Content-Type,X-Amz-Date,Authorization,X-Api-Key'
   - Access-Control-Allow-Origin: '\*'

### Deploy API

1. Create new stage
2. Click "Deploy"
3. Note the Invoke URL

### Frontend Configuration

1. Update the BACKEND_URL in the frontend code to the API URL

## Webserver deployment steps

1. Deploy an Ubuntu EC2 instance and connect with your key
2. Update the system:
   `sudo apt update && sudo apt upgrade -y`
3. Install node and npm:

```
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. Install Nginx:
   `sudo apt install nginx -y`
5. Start Nginx and enable it to run on boot:

```
sudo systemctl start nginx
sudo systemctl enable nginx
```

6. Configure the firewall to allow HTTP and HTTPS traffic:
   `sudo ufw allow 'Nginx Full'`

7. Transfer the frontend to the `/var/www/html/` and the backend to `/var/www/api/`

8. Install the backend (`npm install`) and create the .env file

9. Set the `BACKEND_URL` in the frontend's script.js to the public IP of the instance

10. Install PM2 to manage the node application
    `sudo npm install -g pm2`

11. Start the node application:
    `pm2 start app.js`

12. Edit the Nginx configuration:
    `sudo nano /etc/nginx/sites-available/default`

13. Replace teh contents with:

```
server {
    listen 80;
    server_name your_domain.com;

    location / {
        root /var/www/html;  # Assuming your frontend files are here
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

14. Restart Nginx:
    `sudo systemctl restart nginx`

15. Set permissions for the folder:

```
sudo chown -R ubuntu:www-data /var/www/api/
sudo chmod -R 755 /var/www/api/
```

Hardcoded API key: 3b53cb7a-cf27-4fd3-80c3-6ec7dd5c8275

## Environment variables to set

### Backend

Set the environmental variables:

#### Mandatory

- API_KEY - Sets the API key the frontend needs to submit
- OPENAI_API_KEY - The API key from OpenAI

##### Only for server deployment

- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION

#### Optional

GPT_MODEL - Default is gpt-4o-mini
DAILY_LIMIT - The number of messages a user can send, default is 5
MAX_WORDS - Number of words a message can be, default is 350

##### Only for server deployment

- PORT=<PORT NUMBER> (Optional, default is 3000)

### Frontend

- Set the BACKEND_URL in the top of the script.js file
