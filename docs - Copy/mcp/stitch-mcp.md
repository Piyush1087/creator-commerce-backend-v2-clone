IMPORTANT — Run These Every Session (API Key Mode)

These commands are currently required before using Gemini CLI + Stitch.

1. Set API Key
$env:API_KEY="YOUR_API_KEY"

Example:

$env:API_KEY="AQ.xxxxxxxxxxxxxxxxx"
2. Generate Active Stitch Config
(Get-Content "$HOME\.gemini\extensions\Stitch\gemini-extension-apikey.json") `
-replace "YOUR_API_KEY", $env:API_KEY `
| Set-Content "$HOME\.gemini\extensions\Stitch\gemini-extension.json"



Recommended Setup (Current Working Setup)
Prerequisites

Install:

Node.js
Gemini CLI
Google Cloud SDK (gcloud)
Stitch extension
Install Google Cloud SDK
Windows

Download:

Google Cloud SDK

After install:

gcloud init

Login with the correct Google account.

Verify Active Account
gcloud auth list

Make sure the correct account is active.

Project Info
Project Name: stitch-gemini-playground
Project ID: stitch-gemini-playground
Project Number: 474025474966


Optional: Google Cloud / OAuth Setup

Some Stitch APIs require OAuth authentication.

Use this setup if APIs fail with:

API keys are not supported by this API
Set Project
$env:PROJECT_ID="stitch-gemini-playground"

gcloud config set project $env:PROJECT_ID
Set ADC Quota Project
gcloud auth application-default set-quota-project $env:PROJECT_ID
Enable Stitch MCP Service
gcloud beta services mcp enable stitch.googleapis.com --project=$env:PROJECT_ID
Add IAM Permission
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="user:help@growthverse.in" `
  --role="roles/serviceusage.serviceUsageConsumer"
Generate ADC-Based Stitch Config
(Get-Content "$HOME\.gemini\extensions\Stitch\gemini-extension-adc.json") `
-replace "YOUR_PROJECT_ID", $env:PROJECT_ID `
| Set-Content "$HOME\.gemini\extensions\Stitch\gemini-extension.json"

This switches Stitch into OAuth / ADC authentication mode.

Current Known Issue
Error
MCP ERROR (stitch)

API keys are not supported by this API.
Expected OAuth2 access token or other authentication credentials.
Cause

Some Stitch APIs do NOT support API key auth.

They require:

OAuth2
ADC (Application Default Credentials)
Logged-in Google principal
Useful Commands
Check Current Project
gcloud config get-value project
Check Logged-In Accounts
gcloud auth list
Check ADC Credentials
gcloud auth application-default login
List Projects
gcloud projects list