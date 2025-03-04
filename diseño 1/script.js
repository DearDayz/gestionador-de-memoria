function Process(size, time) {
    this.size = size;
    this.timeLeft = time;
    this.allocatedBlock = null;
    this.id = processID;
    processID += 1;
  
    this.isAllocated = function () {
      return this.allocatedBlock != null;
    };
  
    this.tick = function () {
      this.timeLeft -= 1;
    };
  }
  
  function MemControlBlock(size) {
    this.size = size;
    this.process = null;
    this.available = true;
    this.next = null;
    this.prev = null;
    this.fromPartition = false;
  
    this.setProcess = function (process) {
      if (process == null) {
        this.process = null;
        this.available = true;
      } else {
        this.process = process;
        this.available = false;
      }
    };
  }
  
  function Heap() {
    this.head = null;
    this.size = 0;
  
    this.requestAllocation = function (process) {
      let blockBestFit = this.head;
  
      while (blockBestFit.size < process.size || !blockBestFit.available) {
        blockBestFit = blockBestFit.next;
        if (blockBestFit == null) return false;
      }
  
      let block = blockBestFit.next;
      while (block != null) {
        if (
          block.size >= process.size &&
          block.available &&
          block.size < blockBestFit.size
        ) {
          blockBestFit = block;
        }
        block = block.next;
      }
  
      let spaceLeftover = blockBestFit.size - process.size;
  
      if (spaceLeftover > 0) {
        let newBlock = new MemControlBlock(spaceLeftover);
        let nextBlock = blockBestFit.next;
        if (nextBlock != null) {
          nextBlock.prev = newBlock;
          newBlock.next = nextBlock;
        }
        blockBestFit.next = newBlock;
        newBlock.prev = blockBestFit;
        blockBestFit.size = process.size;
        newBlock.fromPartition = true;
      }
  
      blockBestFit.setProcess(process);
      process.allocatedBlock = blockBestFit;
      return true;
    };
  
    this.deallocateProcess = function (process) {
      process.allocatedBlock.setProcess(null);
      process.allocatedBlock = null;
    };
  
    this.add = function (block) {
      if (this.head == null) {
        this.head = block;
      } else {
        block.next = this.head;
        this.head.prev = block;
        this.head = block;
      }
      this.size += block.size;
    };
  
    this.repaint = function (targetDiv) {
      let block = this.head;
      targetDiv.innerHTML = "";
  
      while (block != null) {
        let height = (block.size / this.size) * 100;
        if (block.fromPartition) {
          height += (memControlBlockSize / this.size) * 100;
        }
  
        let divBlock = document.createElement("div");
        divBlock.style.height = height + "%";
        divBlock.setAttribute("id", "block");
        divBlock.className = block.available ? "available" : "unavailable";
        targetDiv.appendChild(divBlock);
  
        let blockLabel = document.createElement("div");
        blockLabel.setAttribute("id", "blockLabel");
        blockLabel.style.height = height + "%";
        blockLabel.innerHTML = block.size + "K";
        if (height <= 2) blockLabel.style.display = "none";
        divBlock.appendChild(blockLabel);
  
        block = block.next;
      }
    };
  
    this.compact = function () {
      let allocated = [];
      let freeTotal = 0;
      let current = this.head;
  
      while (current !== null) {
        if (!current.available) {
          allocated.push(current);
        } else {
          freeTotal += current.size;
        }
        current = current.next;
      }
  
      let freeBlocks = [];
      let remaining = freeTotal;
      while (remaining > 0) {
        let size = Math.min(256, remaining);
        let block = new MemControlBlock(size);
        block.available = true;
        freeBlocks.push(block);
        remaining -= size;
      }
  
      this.head = null;
      let prevBlock = null;
  
      for (let block of allocated) {
        block.prev = prevBlock;
        block.next = null;
        if (prevBlock !== null) {
          prevBlock.next = block;
        } else {
          this.head = block;
        }
        prevBlock = block;
      }
  
      for (let block of freeBlocks) {
        block.prev = prevBlock;
        block.next = null;
        if (prevBlock !== null) {
          prevBlock.next = block;
        } else {
          this.head = block;
        }
        prevBlock = block;
      }
    };
  
    this.allocateToBlock = function (process, targetBlock) {
      if (!targetBlock.available || targetBlock.size < process.size) {
        return false;
      }
  
      const spaceLeftover = targetBlock.size - process.size - memControlBlockSize;
  
      if (spaceLeftover > 0) {
        const newBlock = new MemControlBlock(spaceLeftover);
        newBlock.next = targetBlock.next;
        newBlock.prev = targetBlock;
        if (targetBlock.next) {
          targetBlock.next.prev = newBlock;
        }
        targetBlock.next = newBlock;
        targetBlock.size = process.size;
        newBlock.fromPartition = true;
      }
  
      targetBlock.setProcess(process);
      process.allocatedBlock = targetBlock;
      return true;
    };
  }
  
  // Variables globales
  var logBox = document.getElementById("logBox");
  var memoryDiv = document.getElementById("memory");
  var virtualMemoryDiv = document.getElementById("virtualMemory");
  var processTable = document.getElementById("processTable");
  var memControlBlockSize = 16;
  var processID = 0;
  var processes = [];
  
  // Inicialización de memorias
  var heap = new Heap();
  var virtualHeap = new Heap();
  [256, 256, 256, 256].forEach((size) => heap.add(new MemControlBlock(size)));
  virtualHeap.add(new MemControlBlock(1024));
  
  // Dibuja ambas memorias
  heap.repaint(memoryDiv);
  virtualHeap.repaint(virtualMemoryDiv);
  
  // Eventos
  document.getElementById("processForm").onsubmit = function () {
    let elements = this.elements;
    let process = new Process(
      parseInt(elements.namedItem("processSize").value),
      parseInt(elements.namedItem("processTime").value)
    );
    processes.push(process);
    addProcessToTable(process);
    elements.namedItem("processSize").value = "";
    elements.namedItem("processTime").value = "";
    return false;
  };
  
  document.getElementById("compactButton").addEventListener("click", function () {
    heap.compact();
    heap.repaint(memoryDiv);
  });
  
  document.getElementById("swapOutButton").addEventListener("click", function () {
    let pid = parseInt(document.getElementById("swapProcessId").value);
    let process = processes.find((p) => p.id === pid);
    if (process && process.isAllocated()) {
      heap.deallocateProcess(process);
      if (virtualHeap.requestAllocation(process)) {
        log("Proceso " + pid + " movido a memoria virtual");
        heap.repaint(memoryDiv);
        virtualHeap.repaint(virtualMemoryDiv);
      } else {
        log("Error: No hay espacio en memoria virtual");
        heap.requestAllocation(process);
      }
    } else {
      log("Proceso no encontrado o no está en memoria principal");
    }
  });
  
  document.getElementById("swapInButton").addEventListener("click", function () {
    let pid = parseInt(document.getElementById("swapProcessId").value);
    let process = processes.find((p) => p.id === pid);
    if (
      process &&
      process.allocatedBlock &&
      virtualHeap.deallocateProcess(process)
    ) {
      if (heap.requestAllocation(process)) {
        log("Proceso " + pid + " movido a memoria principal");
        heap.repaint(memoryDiv);
        virtualHeap.repaint(virtualMemoryDiv);
      } else {
        log("Error: No hay espacio en memoria principal");
        virtualHeap.requestAllocation(process);
      }
    } else {
      log("Proceso no encontrado o no está en memoria virtual");
    }
  });
  
  document.getElementById("relocateButton").addEventListener("click", function () {
    const pid = parseInt(document.getElementById("relocateProcessId").value);
    const blockNumber = parseInt(document.getElementById("relocateBlockNumber").value);
  
    if (isNaN(pid) || isNaN(blockNumber)) {
      alert("Ingrese un ID y número válidos");
      return;
    }
  
    const process = processes.find((p) => p.id === pid);
    if (!process || !process.isAllocated() || !isBlockInHeap(process.allocatedBlock, heap)) {
      alert("Proceso no encontrado o no está en memoria principal");
      return;
    }
  
    let currentBlock = heap.head;
    let currentIndex = 1;
    while (currentBlock && currentIndex < blockNumber) {
      currentBlock = currentBlock.next;
      currentIndex++;
    }
  
    if (!currentBlock || currentIndex !== blockNumber) {
      alert("Bloque no encontrado");
      return;
    }
  
    if (currentBlock === process.allocatedBlock) {
      alert("El proceso ya está en este bloque");
      return;
    }
  
    if (!currentBlock.available || currentBlock.size < process.size) {
      alert("Bloque insuficiente o no disponible");
      return;
    }
  
    heap.deallocateProcess(process);
    const success = heap.allocateToBlock(process, currentBlock);
  
    if (!success) {
      alert("Error al reubicar");
      heap.requestAllocation(process);
      return;
    }
  
    heap.repaint(memoryDiv);
    log(`Proceso ${pid} reubicado al bloque ${blockNumber}`);
  });
  
  // Funciones auxiliares
  function log(string) {
    logBox.innerHTML += string + "<br />";
  }
  
  function addProcessToTable(process) {
    let row = document.createElement("tr");
    row.setAttribute("id", "process" + process.id);
  
    let colName = document.createElement("td");
    colName.innerHTML = process.id;
  
    let colSize = document.createElement("td");
    colSize.innerHTML = process.size;
  
    let colTime = document.createElement("td");
    colTime.setAttribute("id", "process" + process.id + "timeLeft");
    colTime.innerHTML = process.timeLeft;
  
    row.appendChild(colName);
    row.appendChild(colSize);
    row.appendChild(colTime);
    processTable.appendChild(row);
  }
  
  function removeProcessFromTable(process) {
    processTable.removeChild(document.getElementById("process" + process.id));
  }
  
  function refreshTable() {
    processes.forEach((process) => {
      document.getElementById("process" + process.id + "timeLeft").innerHTML =
        process.timeLeft;
    });
  }
  
  function isBlockInHeap(block, heap) {
    let current = heap.head;
    while (current) {
      if (current === block) return true;
      current = current.next;
    }
    return false;
  }
  
  // Reloj de simulación
  setInterval(function () {
    processes.forEach((process, index) => {
      if (!process.isAllocated()) {
        heap.requestAllocation(process);
      } else {
        process.tick();
        if (process.timeLeft < 1) {
          heap.deallocateProcess(process);
          processes.splice(index, 1);
          removeProcessFromTable(process);
        }
      }
    });
    refreshTable();
    heap.repaint(memoryDiv);
    virtualHeap.repaint(virtualMemoryDiv);
  }, 1000);