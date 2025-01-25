import { execSync } from "child_process";
import { Project } from "ts-morph";

// Get old and new folder paths from command-line arguments
const [oldFolderPath, newFolderPath] = process.argv.slice(2);

if (!oldFolderPath || !newFolderPath) {
    console.error("Please provide both old and new folder paths as arguments.");
    process.exit(1);
}

// Function to move files using git mv
function moveFiles(oldPath: string, newPath: string) {
    try {
        execSync(`git mv ${oldPath} ${newPath}`);
        console.log(`Moved ${oldPath} to ${newPath}`);
    } catch (error) {
        console.error(`Failed to move ${oldPath} to ${newPath}:`, error);
    }
}

// Move the folder
moveFiles(oldFolderPath, newFolderPath);

// Initialize the project
const project = new Project({
    tsConfigFilePath: "path/to/tsconfig.json"
});

// Get all source files in the project
const sourceFiles = project.getSourceFiles();

// Iterate over each source file
sourceFiles.forEach(sourceFile => {
    // Get all import declarations
    const importDeclarations = sourceFile.getImportDeclarations();

    importDeclarations.forEach(importDeclaration => {
        // Get the module specifier value
        const moduleSpecifier = importDeclaration.getModuleSpecifierValue();

        // Check if the import path starts with the old folder path
        if (moduleSpecifier.startsWith(oldFolderPath)) {
            // Update the module specifier to the new folder path
            const newModuleSpecifier = moduleSpecifier.replace(oldFolderPath, newFolderPath);
            importDeclaration.setModuleSpecifier(newModuleSpecifier);
        }
    });
});

// Save the changes
project.save().then(() => {
    console.log("Imports updated successfully!");
});