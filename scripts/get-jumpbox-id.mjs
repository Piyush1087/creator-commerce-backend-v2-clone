#!/usr/bin/env node
/**
 * Find the Jumpbox (Dev) or Bastion (Prod) EC2 instance ID for SSM port forwarding.
 * Run with: npx sst shell --stage dev node scripts/get-jumpbox-id.mjs
 * Or: AWS_PROFILE=creator-dev node scripts/get-jumpbox-id.mjs
 */

import { execSync } from 'child_process';

const PROFILE = process.env.AWS_PROFILE || 'creator-dev';
const REGION = 'ap-south-1';

try {
  const result = execSync(
    `aws ec2 describe-instances --profile ${PROFILE} --region ${REGION} --filters "Name=instance-state-name,Values=running" --query "Reservations[*].Instances[*].[InstanceId,Tags[?Key=='Name'].Value|[0]]" --output json`,
    { encoding: 'utf-8' }
  );
  const data = JSON.parse(result);

  const instances = data.flat().filter(([id]) => id);
  // Look for jumpbox (v2 dev) or bastion (legacy/v2 prod)
  const jumpbox = instances.find(([, name]) => 
    (name || '').toLowerCase().includes('jump') || 
    (name || '').toLowerCase().includes('bastion')
  );
  const fallback = instances[0];

  if (jumpbox) {
    console.log('Jumpbox/Bastion instance:', jumpbox[0], '(', jumpbox[1], ')');
  } else if (fallback) {
    console.log('No instance with "jump" or "bastion" in name. First running instance:', fallback[0], '(', fallback[1], ')');
  } else {
    console.log('No running instances found. Ensure you are logged in: aws sso login --profile', PROFILE);
    process.exit(1);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
