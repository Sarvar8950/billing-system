let items = [];
let priceFileHandle = null;
let editingItemId = null;

const DB_NAME = "BillingItemsDB";
const STORE_NAME = "fileHandles";
const openFileButton = document.getElementById("openPriceFile");
const itemForm = document.getElementById("itemForm");
const itemNameInput = document.getElementById("itemName");
const itemPriceInput = document.getElementById("itemPrice");
const saveItemButton = document.getElementById("saveItem");
const cancelEditButton = document.getElementById("cancelEdit");
const itemsBody = document.getElementById("itemsBody");
const statusMessage = document.getElementById("itemStatus");

openFileButton.addEventListener("click", selectPriceFile);
itemForm.addEventListener("submit", saveItem);
cancelEditButton.addEventListener("click", resetItemForm);
restorePriceFile();

async function openFileDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storePriceFileHandle(handle) {
    const db = await openFileDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(handle, "priceFile");
        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function getSavedPriceFileHandle() {
    const db = await openFileDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get("priceFile");
        request.onsuccess = () => {
            db.close();
            resolve(request.result || null);
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

async function restorePriceFile() {
    if (!window.showOpenFilePicker) {
        statusMessage.textContent =
            "Direct editing requires Chrome or Edge on localhost or HTTPS.";
        return;
    }

    try {
        const handle = await getSavedPriceFileHandle();
        if (!handle) {
            statusMessage.textContent = "Select price.json to view and edit items.";
            return;
        }

        const permission = await handle.queryPermission({ mode: "readwrite" });
        if (permission !== "granted") {
            statusMessage.textContent =
                "Select price.json to grant access and continue editing.";
            return;
        }

        priceFileHandle = handle;
        await loadItemsFromFile();
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Unable to restore price.json access: " + error.message;
    }
}

async function selectPriceFile() {
    if (!window.showOpenFilePicker) {
        statusMessage.textContent =
            "Direct editing requires Chrome or Edge on localhost or HTTPS.";
        return;
    }

    try {
        const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{
                description: "Product price list",
                accept: { "application/json": [".json"] }
            }]
        });

        if (handle.name.toLowerCase() !== "price.json") {
            throw new Error("Please select the file named price.json.");
        }

        const permission = await handle.requestPermission({
            mode: "readwrite"
        });
        if (permission !== "granted") {
            throw new Error("Write permission was not granted.");
        }

        priceFileHandle = handle;
        await loadItemsFromFile();
        await storePriceFileHandle(handle);
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);
            statusMessage.textContent =
                "Unable to open price.json: " + error.message;
        }
    }
}

async function loadItemsFromFile() {
    const file = await priceFileHandle.getFile();
    const parsedItems = JSON.parse(await file.text());
    validateItems(parsedItems);

    items = parsedItems;
    renderItems();
    saveItemButton.disabled = false;
    statusMessage.textContent = "Connected: " + file.name;
}

function validateItems(value) {
    if (!Array.isArray(value) || value.some(item =>
        !item ||
        !Number.isSafeInteger(item.id) ||
        item.id < 1 ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        !Number.isFinite(Number(item.price)) ||
        Number(item.price) < 0
    )) {
        throw new Error("The selected file must contain a valid product array.");
    }

    const ids = value.map(item => item.id);
    if (new Set(ids).size !== ids.length) {
        throw new Error("The selected file contains duplicate product IDs.");
    }
}

function renderItems() {
    itemsBody.replaceChildren();

    if (items.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.textContent = "No items yet. Add your first item using the form.";
        row.appendChild(cell);
        itemsBody.appendChild(row);
        return;
    }

    items.forEach((item, index) => {
        const row = document.createElement("tr");
        const indexCell = document.createElement("td");
        const idCell = document.createElement("td");
        const nameCell = document.createElement("td");
        const priceCell = document.createElement("td");
        const actionsCell = document.createElement("td");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");

        indexCell.textContent = index+1;
        idCell.textContent = item.id;
        nameCell.textContent = item.name;
        priceCell.textContent = "₹" + Number(item.price).toFixed(2);

        editButton.type = "button";
        editButton.className = "item-action-btn";
        editButton.setAttribute("aria-label", "Edit " + item.name);
        editButton.title = "Edit item";
        editButton.textContent = "✎";
        editButton.addEventListener("click", () => beginEdit(item.id));

        deleteButton.type = "button";
        deleteButton.className = "item-action-btn item-delete-btn";
        deleteButton.setAttribute("aria-label", "Delete " + item.name);
        deleteButton.title = "Delete item";
        deleteButton.textContent = "×";
        deleteButton.addEventListener("click", () => deleteItem(item.id));

        actionsCell.append(editButton, deleteButton);
        row.append(indexCell, idCell, nameCell, priceCell, actionsCell);
        itemsBody.appendChild(row);
    });
}

function beginEdit(id) {
    const item = items.find(existingItem => existingItem.id === id);
    if (!item) {
        return;
    }

    editingItemId = id;
    itemNameInput.value = item.name;
    itemPriceInput.value = item.price;
    document.getElementById("itemFormTitle").textContent = "Update Item";
    saveItemButton.textContent = "Save Changes";
    cancelEditButton.hidden = false;
    itemNameInput.focus();
}

async function saveItem(event) {
    event.preventDefault();

    if (!priceFileHandle) {
        statusMessage.textContent = "Select price.json before making changes.";
        return;
    }

    const name = itemNameInput.value.trim();
    const price = Number(itemPriceInput.value);
    if (!name || !Number.isFinite(price) || price < 0) {
        statusMessage.textContent = "Enter a valid item name and non-negative price.";
        return;
    }

    let updatedItems;
    if (editingItemId !== null) {
        updatedItems = items.map(item => item.id === editingItemId
            ? { ...item, name, price }
            : item
        );
    } else {
        const nextId = items.reduce(
            (maxId, item) => Math.max(maxId, item.id),
            0
        ) + 1;
        updatedItems = [...items, { id: nextId, name, price }];
    }

    const saved = await saveItems(updatedItems, "Changes saved to price.json.");
    if (saved) {
        resetItemForm();
    }
}

var itemToDelete = null
async function deleteItem(id) {
    const item = items.find(existingItem => existingItem.id === id);
    itemToDelete = item
    if (item) {
        document.getElementById("confirmPopup").style.display = "flex";
    }
}

async function saveItems(updatedItems, successMessage) {
    saveItemButton.disabled = true;
    statusMessage.textContent = "Saving changes...";

    try {
        const permission = await priceFileHandle.queryPermission({
            mode: "readwrite"
        });
        const grantedPermission = permission === "granted"
            ? permission
            : await priceFileHandle.requestPermission({ mode: "readwrite" });

        if (grantedPermission !== "granted") {
            throw new Error("Write permission was not granted.");
        }

        const writable = await priceFileHandle.createWritable();
        try {
            await writable.write(JSON.stringify(updatedItems, null, 2) + "\n");
            await writable.close();
        } catch (error) {
            await writable.abort();
            throw error;
        }

        items = updatedItems;
        renderItems();
        statusMessage.textContent = successMessage;
        return true;
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Unable to save price.json: " + error.message;
        return false;
    } finally {
        saveItemButton.disabled = false;
    }
}

function resetItemForm() {
    editingItemId = null;
    itemForm.reset();
    document.getElementById("itemFormTitle").textContent = "Add Item";
    saveItemButton.textContent = "Add Item";
    cancelEditButton.hidden = true;
}


function closePopup() {
    document.getElementById("confirmPopup").style.display = "none";
}

async function confirmRemoveItem() {
    debugger
    console.log(itemToDelete)
    if(!itemToDelete) {
        return;
    }
    const updatedItems = items.filter(existingItem => existingItem.id !== itemToDelete.id);
    await saveItems(updatedItems, "Item deleted from price.json.");

    closePopup()

    if (editingItemId === itemToDelete.id) {
        resetItemForm();
    }
}