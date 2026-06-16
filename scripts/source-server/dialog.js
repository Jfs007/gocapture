const os = require('os');
const { execFile } = require('child_process');

function runDialog(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message || '').trim() || 'Directory selection failed.'));
        return;
      }
      const selected = String(stdout || '').trim();
      if (!selected) {
        reject(new Error('No directory selected.'));
        return;
      }
      resolve(selected);
    });
  });
}

async function selectDirectory() {
  const platform = os.platform();
  if (platform === 'darwin') {
    return runDialog('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "选择源码项目目录")',
    ]);
  }

  if (platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;',
      '$dialog.Description = "选择源码项目目录";',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.SelectedPath }',
    ].join(' ');
    return runDialog('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
  }

  try {
    return await runDialog('zenity', ['--file-selection', '--directory', '--title=选择源码项目目录']);
  } catch (error) {
    return runDialog('kdialog', ['--getexistingdirectory', process.cwd(), '选择源码项目目录']);
  }
}

module.exports = {
  selectDirectory,
};
