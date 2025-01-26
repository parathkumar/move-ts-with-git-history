
import { execSync } from "child_process";
import { Project, SourceFile } from "ts-morph";
import { dirname, join, relative, resolve } from "path";
import {
    ParsedCommandLine,
    parseJsonConfigFileContent,
    readConfigFile,
    resolveModuleName,
    sys
} from "typescript";
import { readFileSync } from "fs";
function normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
}
function moveFiles(oldPath: string, newPath: string, repoPath: string): void {
    try {
        execSync(`git -C ${repoPath} mv ${oldPath} ${newPath}`);
        console.log(`Moved ${oldPath} to ${newPath}`);
    } catch (error) {
        console.error(`Failed to move ${oldPath} to ${newPath}:`, error);
    }
}
function loadConfig(configPath: string) {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const projectRoot = dirname(config.tsConfigPath);
    const migrations = config.migrations;
    if (!migrations || migrations.length === 0) {
        throw new Error("Please provide both old and new folder paths in the config.");
    }
    return { projectRoot, migrations, tsConfigPath: config.tsConfigPath, tsConfig: readConfigFile(config.tsConfigPath, sys.readFile).config };
}
/**
 * Updates all import declarations in the given source files,
 * adjusting paths that start with the oldFolderPath to newFolderPath.
 */
function updateImportDeclarations(
    sourceFiles: SourceFile[],
    parsedCommandLine: ParsedCommandLine,
    projectRoot: string,
    oldFolderPath: string,
    newFolderPath: string
) {
    sourceFiles.forEach(sourceFile => {
        const importDeclarations = sourceFile.getImportDeclarations();
        importDeclarations.forEach(importDeclaration => {
            const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
            const sourcefilePath = sourceFile.getFilePath();
            const resolvedModule = resolveModuleName(
                moduleSpecifier,
                sourcefilePath,
                parsedCommandLine.options,
                sys
            );
            if (resolvedModule.resolvedModule) {
                const relativeModuleSpecifier = normalizePath(
                    relative(projectRoot, resolvedModule.resolvedModule.resolvedFileName)
                );
                if (
                    relativeModuleSpecifier.includes("node_modules") ||
                    relativeModuleSpecifier.startsWith("@")
                ) {
                    console.log("Ignoring node_modules or scoped package import", moduleSpecifier);
                } else if (relativeModuleSpecifier.startsWith(oldFolderPath)) {
                    console.log("Updating import:", moduleSpecifier);
                    const folderName = normalizePath(oldFolderPath).split("/").pop() ?? "";
                    const newModuleSpecifier = normalizePath(
                        relativeModuleSpecifier.replace(
                            oldFolderPath,
                            join(newFolderPath, folderName)
                        )
                    ).replace(/\.ts$/, "");
                    importDeclaration.setModuleSpecifier(newModuleSpecifier);
                }
            } else {
                console.log("Could not resolve module specifier", moduleSpecifier);
            }
        });
    });
}

function migrate(migration: any, sourceFiles: SourceFile[], parsedCommandLine: ParsedCommandLine, projectRoot: string) {
    // TODO: Add a flag in config to migrate as a folder or all directories in the folder
    const normalizedFrom = normalizePath(migration.from);
    const normalizedTo = normalizePath(migration.to);
    // Update the import declarations
    updateImportDeclarations(sourceFiles, parsedCommandLine, projectRoot, normalizedFrom, normalizedTo);
    // move files
    moveFiles(normalizedFrom, normalizedTo, projectRoot);
}
function main() {
    try {
        const { projectRoot, migrations, tsConfigPath, tsConfig } = loadConfig("config.json");
        const project = new Project({ tsConfigFilePath: tsConfigPath });
        // Get the TypeScript configuration
        const parsedCommandLine = parseJsonConfigFileContent(
            tsConfig,
            sys,
            projectRoot
        );
        // Get all source files in the project
        const sourceFiles = project.getSourceFiles();
        migrations.forEach((migration: any) => {
            migrate(migration, sourceFiles, parsedCommandLine, projectRoot);
        });

        project.save().then(() => {
            console.log("Imports updated successfully!");
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
main();
