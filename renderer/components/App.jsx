import React from 'react';
import FileTree from './FileTree';
import TextEditorPane from './TextEditorPane';
import DeletePrompt from './DeletePrompt';
import MockComponentTree from './MockComponentTree';
import MockComponentInspector from './MockComponentInspector';
import RefreshComponentTreeButton from './RefreshComponentTreeButton';
import RefreshFileDirectory from './RefreshFileDirectory';
import ConsolePane from './ConsolePane';
import { ipcMain } from 'electron';
import InWindowSimulator from './InWindowSimulator';
import TabContainer from './TabContainer';
import WelcomePage from './WelcomePage';
const { ipcRenderer } = require('electron');
const { getTree, getFileExt } = require('../../lib/file-tree');
const fs = require('fs');
const path = require('path');
const { File, Directory } = require('../../lib/item-schema');
const { exec } = require('child_process');

const importPathFunctions = require('../../importPath');

export default class App extends React.Component {
  constructor() {

    super();
    this.state = {
      openTabs: {},
      previousPaths: [],
      openedProjectPath: '',
      openMenuId: null,
      createMenuInfo: {
        id: null,
        type: null
      },
      fileTree: null,
      watch: null,
      rootDirPath: '',
      selectedItem: {
        id: null,
        path: '',
        type: null,
        focused: false
      },
      renameFlag: false,
      fileChangeType: null,
      deletePromptOpen: false,
      newName: '',
      componentTreeObj: null,
      simulator: false,
      url: '',
      cra: false,
      craOut: '',
      outputOrTerminal: 'output',
      liveServerPID: null,
      closed: false,
      toggleTerminal: false,
    };

    this.fileTreeInit();
    this.clickHandler = this.clickHandler.bind(this);
    this.setFileTree = this.setFileTree.bind(this);
    this.dblClickHandler = this.dblClickHandler.bind(this);
    this.setActiveTab = this.setActiveTab.bind(this);
    //this.isFileOpened = this.isFileOpened.bind(this);
    this.saveTab = this.saveTab.bind(this);
    this.closeTab = this.closeTab.bind(this);
    this.openCreateMenu = this.openCreateMenu.bind(this);
    this.closeOpenDialogs = this.closeOpenDialogs.bind(this);
    this.createMenuHandler = this.createMenuHandler.bind(this);
    this.createItem = this.createItem.bind(this);
    this.findParentDir = this.findParentDir.bind(this);
    this.deletePromptHandler = this.deletePromptHandler.bind(this);
    this.renameHandler = this.renameHandler.bind(this);
    this.constructComponentTreeObj = this.constructComponentTreeObj.bind(this);
    this.handleEditorValueChange = this.handleEditorValueChange.bind(this);
    this.openSim = this.openSim.bind(this);
    this.closeSim = this.closeSim.bind(this);
    this.openSimulatorInMain = this.openSimulatorInMain.bind(this);
    this.close = this.close.bind(this)
    this.toggleTerminal = this.toggleTerminal.bind(this);
    this.updateFileDirectory = this.updateFileDirectory.bind(this);

    //reset tabs, should store state in local storage before doing this though
  }

  //when component mounts set the project path
  componentDidMount() {
    ipcRenderer.on('openDir', (event, projPath) => {
      if (this.state.openedProjectPath !== projPath) {
        this.setState({ openTabs: {}, openedProjectPath: projPath });
      }
    });

    //when save file is initiated, save the tab
    ipcRenderer.on('saveFile', (event, arg) => {
      if (this.state.previousPaths[this.state.previousPaths.length - 1] !== null) {
        this.saveTab();
      }
    });

    //
    ipcRenderer.on('delete', (event, arg) => {
      if (this.state.selectedItem.id) {
        this.setState({
          deletePromptOpen: true,
          fileChangeType: 'delete'
        });
      }
    });
    ipcRenderer.on('enter', (event, arg) => {
      if (this.state.selectedItem.focused) {
        //rename property just true or false i guess
        this.setState({
          renameFlag: true
        });
      }
    });
    ipcRenderer.on('start simulator', (event, arg) => {
      console.log('this is start simulator event line 111 appjsx', event);
      this.setState({ url: arg[0], liveServerPID: arg[1] });
    });
    ipcRenderer.on('craOut', (event, arg) => {
      this.setState({ craOut: arg, cra: false });
    });
    ipcRenderer.on('closeSim', (event, arg) => {
      this.setState({ url: ' ' })
    })
  }
  /**
   * Creates component Tree object for rendering by calling on methods defined in importPath.js
   */
  constructComponentTreeObj() {
    const projInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/projInfo.js')));
    //checks if there is react entry point by checking our properties in projinfo that is generated by file-tree.js
    if (projInfo.reactEntry !== '') {
      let rootPath = path.dirname(projInfo.reactEntry);
      let fileName = path.basename(projInfo.reactEntry);
      const componentObj = importPathFunctions.constructComponentTree(fileName, rootPath);
      console.log('componentObj = ', componentObj)
      this.setState({
        componentTreeObj: componentObj
      });
    } else if (projInfo.reactEntry === '') {
      let rootPath = path.dirname(projInfo.reactEntry);
      let fileName = path.basename(projInfo.reactEntry);
      const componentObj = importPathFunctions.constructComponentTree(fileName, rootPath);
      this.setState({
        componentTreeObj: componentObj
      });
    }//If there is no webpack, it checks if its create react app application
    else if (projInfo.CRA === true) {
      let rootPath = path.join(projInfo.rootPath, 'src');
      const componentObj = importPathFunctions.constructComponentTree('App.js', rootPath);
      this.setState({
        componentTreeObj: componentObj
      });
    }
    else if (projInfo.reactEntry === '') {
      let rootPath = path.dirname(projInfo.reactEntry);
      let fileName = path.basename(projInfo.reactEntry);
      const componentObj = importPathFunctions.constructComponentTree(fileName, rootPath);
      console.log('componentObj = ', componentObj)
      this.setState({
        componentTreeObj: componentObj
      })
    }
    // if neither Create React App or have webpack, then can't render it 
    else {
      this.setState({
        componentTreeObj: {}
      });
    }
  }

  /**
   * Registers listeners for opening projects and new projects
   */

  fileTreeInit() {
    ipcRenderer.on('openDir', (event, dirPath) => {
      if (dirPath !== this.state.rootDirPath) { 
        this.setFileTree(dirPath);
      }
    }),
      ipcRenderer.on('newProject', (event, arg) => {
        if (this.state.watch) this.state.watch.close();
        console.log(this.state)

        this.setState({
          fileTree: null,
          watch: null,
          rootDirPath: '',
          selectedItem: {
            id: null,
            path: null,
            type: null
          },
          cra: true,
        });
      })
  }
  /**
   * sends old path and new name to main process to rename, closes rename form and sets filechangetype and newName for fswatch
   * @param {Javascript event Object} event 
   */
  renameHandler(event) {
    if (event.key === 'Enter' && event.target.value) {
      ipcRenderer.send('rename', this.state.selectedItem.path, event.target.value);
      this.setState({
        renameFlag: false,
        fileChangeType: 'rename',
        newName: event.target.value
      });
    } else if (event.key === 'Enter' && !event.target.value) {
      this.setState({
        renameFlag: false
      });
    }
    let copyObj = {
      createMenuInfo: {
        id: null,
        type: null
      }
    }
    this.setState({ createMenuInfo: copyObj, openMenuId: null });
  }
  //handles click event from delete prompt
  deletePromptHandler(answer) {
    if (answer) {
      ipcRenderer.send('delete', this.state.selectedItem.path);
    } else {
      this.setState({
        fileChangeType: null
      });
    }
    this.setState({
      deletePromptOpen: false
    });
  }
  /**
   * handles click events for directories and files in file tree render, if you click a directory, it will run through the directory and open all its files in the file-tree
   */
  clickHandler(id, filePath, type, event) {
    const temp = this.state.fileTree;
    // when clicked on '+'  
    document.body.onkeydown = event => {
      if (event.key === 'Enter') {
        this.setState({
          renameFlag: true
        });
        document.body.onkeydown = () => { };
      }
    };
    if (type === 'directory') {
      function toggleClicked(dir) {
        if (dir.path === filePath) {
          dir.opened = !dir.opened;
          return;
        } else {
          for (var i = 0; i < dir.subdirectories.length; i++) {
            toggleClicked(dir.subdirectories[i]);
          }
        }
      }

      toggleClicked(temp);
    }
    //so opened menu doesn't immediately close
    if (this.state.openMenuId === null) event.stopPropagation();

    this.setState({
      selectedItem: {
        id,
        path: filePath,
        type: type,
        focused: true
      },
      fileTree: temp,
      renameFlag: false,
      createMenuInfo: {
        id: null,
        type: null
      }
    });
  }
  /**
   * calls file-tree module and sets state with file tree object representation in callback
   */
  setFileTree(dirPath) {
    if (!fs.existsSync(path.join(dirPath, '/reactide.js'))) {
      exec(`npm i -S reactide-config && echo 'const yes = require("'reactide-config'") \n yes.config()' >> reactide.js && node reactide.js `,{
        cwd: dirPath
      });  
    }
    getTree(dirPath, fileTree => {
      //if watcher instance already exists close it as it's for the previously opened project
      if (this.state.watch) {
        this.state.watch.close();
      }
      //Setting up fs.watch to watch for changes that occur anywhere in the filesystem
      let watch = fs.watch(dirPath, { recursive: true, persistent: true }, (eventType, fileName) => {
        if (eventType === 'rename') {
          const fileTree = this.state.fileTree;

          const absPath = path.join(this.state.rootDirPath, fileName);
          const parentDir = this.findParentDir(path.dirname(absPath), fileTree);
          const name = path.basename(absPath);
          const openTabs = this.state.openTabs;
          //Delete handler
          if (this.state.fileChangeType === 'delete') {
            let index;
            if (this.state.selectedItem.type === 'directory') {
              index = this.findItemIndex(parentDir.subdirectories, name);
              parentDir.subdirectories.splice(index, 1);
            } else {
              index = this.findItemIndex(parentDir.files, name);
              parentDir.files.splice(index, 1);
            }
            for (var i = 0; i < this.state.openTabs.length; i++) {
              if (openTabs[i].name === name) {
                openTabs.splice(i, 1);
                break;
              }
            }
          } else if (this.state.fileChangeType === 'new') {
            //new handler
            if (this.state.createMenuInfo.type === 'directory') {
              parentDir.subdirectories.push(new Directory(absPath, name));
            } else {
              parentDir.files.push(new File(absPath, name, getFileExt));
              console.log(parentDir.files);
            }
          } else if (this.state.fileChangeType === 'rename' && this.state.newName) {
            //rename handler
            //fileName has new name, selectedItem has old name and path
            let index;
            if (this.state.selectedItem.type === 'directory') {
              index = this.findItemIndex(parentDir.subdirectories, name);
              parentDir.subdirectories[index].name = this.state.newName;
              parentDir.subdirectories[index].path = path.join(path.dirname(absPath), this.state.newName);
            } else {
              index = this.findItemIndex(parentDir.files, name);
              parentDir.files[index].name = this.state.newName;
              parentDir.files[index].path = path.join(path.dirname(absPath), this.state.newName);
            }
            //renames path of selected renamed file so it has the right info
            this.setState({
              selectedItem: {
                id: this.state.selectedItem.id,
                type: this.state.selectedItem.type,
                path: path.join(path.dirname(absPath), this.state.newName)
              }
            });
            //rename the opened tab of the renamed file if it's there
            for (var i = 0; i < this.state.openTabs.length; i++) {
              if (openTabs[i].name === name) {
                openTabs[i].name = this.state.newName;
                break;
              }
            }
          }
          this.setState({
            fileTree,
            fileChangeType: null,
            newName: '',
            createMenuInfo: {
              id: null,
              type: null
            },
            openTabs
          });
        }
      });
      
      this.setState({
        fileTree,
        rootDirPath: dirPath,
        watch
      });
      ipcRenderer.send('closeSplash');

      this.constructComponentTreeObj();
    });
  }
  /**
   * returns index of file/dir in files or subdirectories array
   */
  findItemIndex(filesOrDirs, name) {
    for (var i = 0; i < filesOrDirs.length; i++) {
      if (filesOrDirs[i].name === name) {
        return i;
      }
    }
    return -1;
  }
  /**
   * returns parent directory object of file/directory in question
   */
  findParentDir(dirPath, directory = this.state.fileTree) {
    if (directory && directory.path === dirPath) return directory;
    else {
      let dirNode;
      for (var i in directory.subdirectories) {
        dirNode = this.findParentDir(dirPath, directory.subdirectories[i]);
        if (dirNode) return dirNode;
      }
    }
  }
  /**
   * click handler for right-click on directories/files, 'opens' new file/dir menu by setting openMenuID state
   */
  openCreateMenu(id, itemPath, type, event) {
    event.stopPropagation();
    this.setState({
      openMenuId: id,
      selectedItem: {
        id: id,
        path: itemPath,
        type
      }
    });
  }
  /**
   * Handler to determine what action to take based on which option in the Menu that opened after right-click
   * @param {Integer} id of the menu being opened (pertaining to a certain file/directory)
   * @param {String} type either file or directory
   * @param {Object} event event object
   * @param {String} actionType either rename, delete, or new
   * @param {String} path Path to the file or directory being changed
   */
  createMenuHandler(id, type, event, actionType, path) {
    //unhook keypress listeners
    document.body.onkeydown = () => { };
    event.stopPropagation();
    if (actionType === 'rename') {
      this.setState({
        renameFlag: true
      });
    } else if (actionType === 'delete') {

      ipcRenderer.send('delete', path);
      this.setState({
        fileChangeType: 'delete'
      });
    } else {
      this.setState({
        createMenuInfo: {
          id,
          type
        },
        openMenuId: null
      });
    }
  }
  /**
   * sends input name to main, where the file/directory is actually created.
   * creation of new file/directory will trigger watch handler
   */

  createItem(event) {
    if (event.key === 'Enter') {
      //send path and file type to main process to actually create file/dir only if there is value
      if (event.target.value)
        ipcRenderer.send(
          'createItem',
          this.state.selectedItem.path,
          event.target.value,
          this.state.createMenuInfo.type
        );
      //set type of file change so watch handler knows which type
      this.setState({
        fileChangeType: 'new'
      });
    }
  }

  /**
   * On close tab, change state to reflect the current Tabs that need to be rendered
   * @param {String} path Path of tab that is about to be closed
   * @param {*} event Event Object
   */
  closeTab(path, event) {
    const copyOpenTabs = Object.assign({}, this.state.openTabs);
    const history = this.state.previousPaths.slice().filter((elem) => {
      return elem !== path;
    });
    for (let key in copyOpenTabs) {
      if (key === path) {
        delete copyOpenTabs[key];
        break;
      }
    }
    event.stopPropagation();
    this.setState({ openTabs: copyOpenTabs, previousPaths: history });
  }
  /**
   * Save tab handler --> Writes to filesystem of whichever path is being changed
   */
  saveTab() {
    fs.writeFileSync(this.state.previousPaths[this.state.previousPaths.length - 1], this.state.openTabs[this.state.previousPaths[this.state.previousPaths.length - 1]].editorValue, { encoding: 'utf8' });
  }
  /**
   * Sets active tab to change highlighting, and to determine which Monaco model is open
   * @param {String} path Path of the tab being set to Active
   */
  setActiveTab(path) {
    let copyPreviousPaths = this.updateHistory(path);
    this.setState({ previousPaths: copyPreviousPaths })
  }
  /** 
   * Add a path to the previousPaths, in order to determine which path to pop back to on tab close
   * @param {String} path Path of tab that needs to be put into the history arr
   */
  updateHistory(path) {
    let copyPreviousPaths = this.state.previousPaths;
    copyPreviousPaths.push(path);
    return copyPreviousPaths;
  }

  /**
   * On double click of a file, create a new Tab for the file being opened, and push it into previousPaths
   * @param {Object} file Object being clicked on, the Object describes the files name, path, ext, etc.
   */
  dblClickHandler(file) {
    const history = this.updateHistory(file.path);
    if (!(Object.keys(this.state.openTabs).includes(file.path))) {
      const openTabs = Object.assign({}, this.state.openTabs);
      openTabs[file.path] = {
        path: file.path,
        name: file.name,
        modified: false,
        editorValue: ''
      };
      this.setState({ openTabs: openTabs, previousPaths: history });
    } else {
      this.setState({ previousPaths: history })
    }
  }

  /**
   * Open up the simulator by sending a message to ipcRenderer('openSimulator')
   */
  openSim() {
    ipcRenderer.send('openSimulator', 'helloworld');
  }
  /**
   * Opens up simulator within IDE window by sending a message to ipcRenderer('start simulator')
   * Changes state of simulator to true to trigger conditional rendering of Editor and Simulator
   */
  openSimulatorInMain() {
    if(this.state.simulator === false){
      this.setState({ simulator: true });
      ipcRenderer.send('start simulator', 'helloworld');
    } else {
      this.closeSim()
    }
  }
  /**
   * closes any open dialogs, handles clicks on anywhere besides the active open menu/form
   */
  closeOpenDialogs() {
    const selectedItem = this.state.selectedItem;
    selectedItem.focused = false;

    document.body.onkeydown = () => { };
    this.setState({
      openMenuId: null,
      createMenuInfo: {
        id: null,
        type: null
      },
      selectedItem,
      renameFlag: false
    });
  }

  /**
   * Auto save on change of the editor
   * @param {String} value Contents of the Monaco editor instance
   */
  handleEditorValueChange(value) {
    const copyOpenTabs = Object.assign({}, this.state.openTabs)
    const copyTabObject = Object.assign({}, this.state.openTabs[this.state.previousPaths[this.state.previousPaths.length - 1]]);
    copyTabObject.editorValue = value;
    copyOpenTabs[this.state.previousPaths[this.state.previousPaths.length - 1]] = copyTabObject;
    this.setState({ openTabs: copyOpenTabs }, () => this.saveTab());
  }
  closeSim() {
    this.setState({ simulator: false });
    ipcRenderer.send('closeSim', this.state.liveServerPID);
  }

  close() {
    this.setState({ closed: !this.state.closed })
  }
  toggleTerminal() {
    this.setState({ toggleTerminal: !this.state.toggleTerminal })
  }
  /**
   * render function for TextEditorPane
   */
  renderTextEditorPane() {
    return (
      <TextEditorPane
        close={this.close}
        toggleTerminal={this.toggleTerminal}
        appState={this.state}
        setActiveTab={this.setActiveTab}
        closeTab={this.closeTab}
        cbOpenSimulator_Main={this.openSimulatorInMain}
        cbOpenSimulator_Ext={this.openSim}
        onEditorValueChange={this.handleEditorValueChange}
      />);
  }

  renderSideLayout() {
    return (
      <ride-pane style={{ flexGrow: 0, flexBasis: this.state.closed ? 0 : 275 }}>
        <div className="item-views">
          <div className="styleguide pane-item">
            <header className="styleguide-header">
              <h5>File Directory</h5>

              <div id="comptree-titlebar-right">
                {this.state.fileTree &&
                  <RefreshFileDirectory updateFileDirectory={this.updateFileDirectory} />}
              </div>

            </header>
            <main className="styleguide-sections">
              {this.state.fileTree &&
                <FileTree
                  dblClickHandler={this.dblClickHandler}
                  openCreateMenu={this.openCreateMenu}
                  openMenuId={this.state.openMenuId}
                  createMenuInfo={this.state.createMenuInfo}
                  createMenuHandler={this.createMenuHandler}
                  createItem={this.createItem}
                  fileTree={this.state.fileTree}
                  selectedItem={this.state.selectedItem}
                  clickHandler={this.clickHandler}
                  renameFlag={this.state.renameFlag}
                  renameHandler={this.renameHandler}
                />
              }
            </main>
          </div>
        </div>
        {this.state.deletePromptOpen
          ? <DeletePrompt
            deletePromptHandler={this.deletePromptHandler}
            name={path.basename(this.state.selectedItem.path)}
          />
          : <span />}
        <div className="item-views">
          <div className="styleguide pane-item">
            <header className="styleguide-header">
              <div id="comptree-titlebar-left">
                <h5>Component Tree</h5>
              </div>
              <div id="comptree-titlebar-right">
                {this.state.componentTreeObj &&
                  <RefreshComponentTreeButton constructComponentTreeObj={this.constructComponentTreeObj} />}
              </div>
            </header>

            <main className="styleguide-sections">
              {
                this.state.componentTreeObj &&
                <MockComponentTree componentTreeObj={this.state.componentTreeObj} />
              }
            </main>
          </div>
        </div>
      </ride-pane>
    );
  }

  renderMainTopPanel() {
    let renderer = [];

    if (this.state.simulator) {

      renderer.push(
        <React.Fragment>
          <InWindowSimulator url={this.state.url} />
          <button className="btn" onClick={this.closeSim}>
            {/* Close Simulator */}
          </button>
        </React.Fragment>
      );
      renderer.push(
        <TabContainer
          close={this.close}
          toggleTerminal={this.toggleTerminal}
          appState={this.state}
          setActiveTab={this.setActiveTab}
          closeTab={this.closeTab}
          cbOpenSimulator_Main={this.openSimulatorInMain}
          cbOpenSimulator_Ext={this.openSim}
        />)
    }
    else {
      renderer.push(
        <TabContainer
          close={this.close}
          toggleTerminal={this.toggleTerminal}
          appState={this.state}
          setActiveTab={this.setActiveTab}
          closeTab={this.closeTab}
          cbOpenSimulator_Main={this.openSimulatorInMain}
          cbOpenSimulator_Ext={this.openSim}
        />)
      renderer.push(this.renderTextEditorPane());
    }
    return renderer;
  }

  renderMainBottomPanel() {
    if (this.state.simulator) {
      return this.renderTextEditorPane();
    }
  }
  renderTerminal() {
    if (this.state.toggleTerminal) {
      return (
        <ConsolePane
          rootDirPath={this.state.rootDirPath}
          cb_setFileTree={this.setFileTree}
          cb_cra={this.state.cra}
          cb_craOut={this.state.craOut}
        />);
    }
  }
  renderMainLayout() {
    return (
      <ride-pane style={{ flexGrow: 1, flexBasis: '1200px' }}>
        {this.state.rootDirPath ?
          <React.Fragment>
            {this.renderMainTopPanel()}
            {this.renderMainBottomPanel()}
            {this.renderTerminal()}
          </React.Fragment> : <WelcomePage/>
        }
      </ride-pane>
    );
  }

  updateFileDirectory() {
    this.setFileTree(this.state.rootDirPath);
  }

  render() {
    return (
      <ride-workspace className="scrollbars-visible-always" onClick={this.closeOpenDialogs}>
        <ride-panel-container className="header" />
        <ride-pane-container>
          <ride-pane-axis className="horizontal">
            {this.renderSideLayout()}
            {this.renderMainLayout()}
          </ride-pane-axis>
        </ride-pane-container>
      </ride-workspace>
    );
  }
}
