set TEST_EMAIL=vindu@123
set TEST_PASSWORD=vindu@123
k6 run freshfarm-load-test.js

Create: PROJECT\load-testing\login-test.js

import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1,
  iterations: 1
};

export default function () {

  const email = __ENV.TEST_EMAIL;
  const password = __ENV.TEST_PASSWORD;

  console.log("Testing email:", email);

  const response = http.post(
    "http://localhost:5000/login",

    JSON.stringify({
      email: email,
      password: password
    }),

    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  console.log(
    "STATUS:",
    response.status
  );

  console.log(
    "BODY:",
    response.body
  );

  check(response, {
    "login status is 200":
      (r) => r.status === 200
  });
}

Now in the same CMD window, set the credentials of the user you normally use successfully on your website:

in cmd : set TEST_EMAIL=aravindtest@gmail.com
	set TEST_PASSWORD=YOUR_ACTUAL_TEST_PASSWORD

Verify Windows actually stored them:in cmd

echo %TEST_EMAIL%

Then run: k6 run login-test.js

We want:
STATUS: 200

BODY:
{"message":"Login successful","token":"eyJ..."}

If instead you get:
STATUS: 401

{"message":"Invalid email or password"}

then the credentials are wrong.

If you get: STATUS: 500

then we have a backend/database problem.

One more improvement: don't start at 50 VUs immediately. After login works, we'll first test:

1 user  → smoke test
5 users → sanity test
20 users → normal load
50 users → heavier load
100+ users → stress test



set TEST_EMAIL=vindu@123
set TEST_PASSWORD=vindu@123
k6 run freshfarm-realistic-test.js

Do this in MySQL Workbench

First run: SET SQL_SAFE_UPDATES = 0;

Then delete the notifications first:
DELETE FROM notifications
WHERE order_id IN (
    SELECT id
    FROM orders
    WHERE customer_name LIKE 'K6 Load Test%'
);

Then delete the test orders:
DELETE FROM orders
WHERE customer_name LIKE 'K6 Load Test%';

Then turn Safe Update Mode back on:
SET SQL_SAFE_UPDATES = 1;

Finally verify:
SELECT id, customer_name, status
FROM orders
WHERE customer_name LIKE 'K6 Load Test%';


SELECT id, order_id, type, message
FROM notifications
WHERE order_id IN (
    SELECT id
    FROM orders
    WHERE customer_name LIKE 'K6 Load Test%'
);

Both should return: 0 row(s)

-------------------------------------------------
---------------------------------------------------

{
    "GroupId": "sg-09f0e417d7ef9ae5f",
    "SecurityGroupArn": "arn:aws:ec2:us-east-1:366486935375:security-group/sg-09f0e417d7ef9ae5f"
}


aws ec2 authorize-security-group-ingress ^
  --region us-east-1 ^
  --group-id sg-09f0e417d7ef9ae5f ^
  --protocol tcp ^
  --port 3306 ^
  --source-group sg-07558b3902fb3ec91

{
    "Return": true,
    "SecurityGroupRules": [
        {
            "SecurityGroupRuleId": "sgr-08f91297f6ea54a20",
            "GroupId": "sg-09f0e417d7ef9ae5f",
            "GroupOwnerId": "366486935375",
            "IsEgress": false,
            "IpProtocol": "tcp",
            "FromPort": 3306,
            "ToPort": 3306,
            "ReferencedGroupInfo": {
                "GroupId": "sg-07558b3902fb3ec91",
                "UserId": "366486935375"
            },
            "SecurityGroupRuleArn": "arn:aws:ec2:us-east-1:366486935375:security-group-rule/sgr-08f91297f6ea54a20"
        }
    ]
}


{
    "DBSubnetGroup": {
        "DBSubnetGroupName": "freshfarm-db-subnets",
        "DBSubnetGroupDescription": "Fresh Farm RDS subnet group",
        "VpcId": "vpc-01206c464306cb2ad",
        "SubnetGroupStatus": "Complete",
        "Subnets": [
            {
                "SubnetIdentifier": "subnet-0a313029a634d7445",
                "SubnetAvailabilityZone": {
                    "Name": "us-east-1d"
                },
                "SubnetOutpost": {},
                "SubnetStatus": "Active"
            },
            {
                "SubnetIdentifier": "subnet-026b1a3af7af623fc",
                "SubnetAvailabilityZone": {
                    "Name": "us-east-1b"
                },
                "SubnetOutpost": {},
                "SubnetStatus": "Active"
            },
            {
                "SubnetIdentifier": "subnet-012f3da92be7a9ef1",
                "SubnetAvailabilityZone": {
                    "Name": "us-east-1b"
                },
                "SubnetOutpost": {},
                "SubnetStatus": "Active"
            },
            {
                "SubnetIdentifier": "subnet-0f70b0948f0e70496",
                "SubnetAvailabilityZone": {
                    "Name": "us-east-1d"
                },
                "SubnetOutpost": {},
                "SubnetStatus": "Active"
            }
        ],
        "DBSubnetGroupArn": "arn:aws:rds:us-east-1:366486935375:subgrp:freshfarm-db-subnets",
        "SupportedNetworkTypes": [
            "IPV4"
        ]
    }
}

aws rds create-db-instance ^
  --region us-east-1 ^
  --db-instance-identifier freshfarm-mysql ^
  --db-instance-class db.t3.micro ^
  --engine mysql ^
  --allocated-storage 20 ^
  --storage-type gp3 ^
  --master-username freshfarmadmin ^
  --master-user-password "Aravind16" ^
  --db-name freshfarm ^
  --db-subnet-group-name freshfarm-db-subnets ^
  --vpc-security-group-ids sg-09f0e417d7ef9ae5f ^
  --no-publicly-accessible ^
  --backup-retention-period 1 ^
  --no-multi-az


Aravind16
Docker token: <YOUR_DOCKERHUB_ACCESS_TOKEN>


eksctl create iamserviceaccount ^
  --cluster freshfarm-eks ^
  --region us-east-1 ^
  --namespace kube-system ^
  --name aws-load-balancer-controller ^
  --attach-policy-arn arn:aws:iam::366486935375:policy/AWSLoadBalancerControllerIAMPolicy ^
  --override-existing-serviceaccounts ^
  --approve

Your Browser
     │
     │ HTTP :80
     ▼
 Internet
     │
     ▼
AWS ALB
     │
     ▼
Gateway
freshfarm-gateway
     │
     ▼
HTTPRoute
freshfarm-route
     │
     │ /
     ▼
frontend Service :80
     │
     ▼
frontend Pod
NGINX
     │
     ├── /api/user/
     │       ↓
     │   user-service
     │
     ├── /api/orders/
     │       ↓
     │   order-service
     │
     ├── /api/payments/
     │       ↓
     │   payment-service
     │
     └── /api/notifications/
             ↓
         notification-service
             │
             ▼
          RDS MySQL