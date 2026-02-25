import path from 'path';
import { generateReport } from '../services/report-generator.js';
import { getGlobalDir } from '../storage/repo-manager.js';

export const reportCommand = async (
  target: string,
  opts: { 
    output?: string; 
    token?: string; 
    code?: boolean;
    keep?: boolean;
  }
) => {
  if (!target) {
    console.log('Usage: gitnexus report <github-url-or-owner/repo>');
    console.log('');
    console.log('Examples:');
    console.log('  gitnexus report https://github.com/owner/repo');
    console.log('  gitnexus report owner/repo');
    console.log('  gitnexus report owner/repo --output ./reports');
    console.log('  gitnexus report owner/repo --token ghp_xxx');
    return;
  }

  // Normalize target to full URL
  let repoUrl = target;
  if (!target.startsWith('http')) {
    repoUrl = `https://github.com/${target}`;
  }

  const outputDir = opts.output ? path.resolve(opts.output) : undefined;
  const token = opts.token || process.env.GITHUB_TOKEN;
  const includeCode = Boolean(opts.code);
  const cleanup = !opts.keep;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           GitNexus Remote Repository Report                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Repository: ${repoUrl}`);
  console.log(`Output: ${outputDir || path.join(getGlobalDir(), 'reports')}`);
  console.log(`Cleanup after: ${cleanup ? 'Yes' : 'No (keeping cloned repo)'}`);
  console.log('');

  const startTime = Date.now();
  let lastPercent = 0;

  try {
    const { outputPath, report } = await generateReport(
      {
        repoUrl,
        outputDir,
        includeCode,
        token,
        cleanup,
      },
      (message, percent) => {
        if (percent > lastPercent) {
          const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
          process.stdout.write(`\r[${bar}] ${percent}% - ${message.padEnd(40)}`);
          lastPercent = percent;
        }
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    Report Generated!                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📄 Report saved to: ${outputPath}`);
    console.log('');
    console.log('Summary:');
    console.log(`  • Repository: ${report.metadata.owner}/${report.metadata.repoName}`);
    console.log(`  • Primary Language: ${report.overview.primaryLanguage}`);
    console.log(`  • Files Analyzed: ${report.overview.totalFiles.toLocaleString()}`);
    console.log(`  • Lines of Code: ${report.overview.totalLines.toLocaleString()}`);
    console.log(`  • Symbols Found: ${report.overview.totalSymbols.toLocaleString()}`);
    console.log(`  • Relationships: ${report.overview.totalRelationships.toLocaleString()}`);
    console.log(`  • Communities: ${report.overview.communities}`);
    console.log(`  • Execution Flows: ${report.overview.executionFlows}`);
    console.log('');
    console.log(`⏱️  Completed in ${elapsed}s`);
    console.log('');

  } catch (error) {
    console.log('\n');
    console.error('❌ Report generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};
