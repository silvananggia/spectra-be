const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Execute shell command and return result
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function executeCommand(command, options = {}) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      ...options,
    });
    
    if (stderr && !options.ignoreStderr) {
      console.warn('Command stderr:', stderr);
    }
    
    return { stdout, stderr };
  } catch (error) {
    console.error(`Error executing command: ${command}`, error);
    throw error;
  }
}

module.exports = {
  executeCommand,
};

