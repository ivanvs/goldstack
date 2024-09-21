import { logger } from '@goldstack/utils-cli';
import { exec, zip } from '@goldstack/utils-sh';
import { existsSync } from 'fs';
import { join } from 'path';

// Helper function to execute commands remotely via SSH
const sshExec = (host: string, command: string): string => {
  const sshCmd = `ssh  -o StrictHostKeyChecking=no ${host} "${command}"`;
  return exec(sshCmd);
};

// Helper function to upload files via SCP
const scpUpload = (
  localPath: string,
  remotePath: string,
  host: string
): string => {
  const scpCmd = `scp  -o StrictHostKeyChecking=no ${localPath} ${host}:${remotePath}`;
  return exec(scpCmd);
};

// Method to create the zip file
const createZip = async (sourceDir: string, outputZip: string) => {
  logger().info(`Creating zip from ${sourceDir}...`);
  await zip({
    directory: sourceDir,
    target: outputZip,
  });

  logger().info(`Zip created at ${outputZip}`);
};

// Deploy function
export const sshDeploy = async (host: string) => {
  const localDir = 'server/';
  const zipPath = 'dist/server.zip';
  const credentialsPath = 'dist/credentials/credentials.json';
  const remoteAppDir = '/home/goldstack/app';
  const remoteZipPath = '/home/goldstack/server.zip';
  const remoteCredentialsPath = '/home/goldstack/credentials.json';

  try {
    // Step 1: Create the zip file
    await createZip(localDir, zipPath);

    // Step 2: Upload the zip file via SCP
    logger().info('Uploading zip file...');
    scpUpload(zipPath, '/home/goldstack', host);

    // Step 3: Stop the app by running stop.sh remotely
    logger().info('Stopping the app...');
    sshExec(host, `cd ${remoteAppDir} && chmod +x ./stop.sh && sudo ./stop.sh`);

    // Step 4: Delete the existing app contents
    logger().info('Deleting old app contents...');
    sshExec(host, `rm -rf ${remoteAppDir}/*`);

    // Step 5: Unzip the uploaded file to the app folder
    logger().info('Unzipping the file...');
    sshExec(host, `unzip -o ${remoteZipPath} -d ${remoteAppDir}`);

    // Step 6: Upload credentials if they exist
    if (existsSync(credentialsPath)) {
      logger().info('Uploading credentials...');
      scpUpload(credentialsPath, remoteCredentialsPath, host);

      // Step 7: Unpackage secrets into /home/goldstack/app/secrets
      logger().info('Unpacking secrets...');
      sshExec(host, 'bash /home/goldstack/unpack-secrets.sh');
    }

    // Step 8: Start the app by running start.sh
    logger().info('Starting the app...');
    sshExec(
      host,
      `cd ${remoteAppDir} && chmod +x ./start.sh && sudo ./start.sh`
    );

    logger().info('Deployment completed successfully.');
  } catch (error) {
    logger().error(`Error during deployment: ${error}`);
    throw error;
  }
};
