
let products = [];
let cart = [];

const priceJsonDisconnected = document.getElementById("priceJsonDisconnected");
const priceFileStatus = document.getElementById("priceFileStatus");
const PRICE_FILE_DB = "BillingItemsDB";
const PRICE_FILE_STORE = "fileHandles";
let priceFileHandle = null;

document.getElementById("selectPriceFile").addEventListener(
    "click",
    selectPriceFile
);
restorePriceFile();

async function openPriceFileDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(PRICE_FILE_DB, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(PRICE_FILE_STORE)) {
                request.result.createObjectStore(PRICE_FILE_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storePriceFileHandle(handle) {
    const db = await openPriceFileDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PRICE_FILE_STORE, "readwrite");
        transaction.objectStore(PRICE_FILE_STORE).put(handle, "priceFile");
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
    const db = await openPriceFileDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PRICE_FILE_STORE, "readonly");
        const request = transaction.objectStore(PRICE_FILE_STORE).get("priceFile");
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
        priceFileStatus.textContent =
            "Persistent file access requires Chrome or Edge on localhost or HTTPS.";
        return;
    }

    try {
        const handle = await getSavedPriceFileHandle();
        if (!handle) {
            return;
        }

        const permission = await handle.queryPermission({ mode: "read" });
        if (permission !== "granted") {
            priceFileStatus.textContent =
                "File access needs permission again. Select price.json to reconnect.";
            return;
        }

        await loadProducts(handle);
    } catch (error) {
        console.error(error);
        priceFileStatus.textContent =
            "Unable to restore price.json access: " + error.message;
    }
}

async function selectPriceFile() {
    if (!window.showOpenFilePicker) {
        priceFileStatus.textContent =
            "Persistent file access requires Chrome or Edge on localhost or HTTPS.";
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

        const permission = await handle.requestPermission({ mode: "read" });
        if (permission !== "granted") {
            throw new Error("Read permission was not granted.");
        }

        await loadProducts(handle);
        try {
            await storePriceFileHandle(handle);
        } catch (error) {
            console.error(error);
            priceFileStatus.textContent =
                "Loaded price.json, but could not remember it: " + error.message;
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);
            priceJsonDisconnected.style.display = "block";
            priceFileStatus.textContent =
                "Unable to load price.json: " + error.message;
        }
    }
}

// Load products from the user-selected JSON file
async function loadProducts(handle) {

    try {
        const file = await handle.getFile();
        const selectedProducts = JSON.parse(await file.text());
        validateProducts(selectedProducts);

        products = selectedProducts;
        displayProducts(products);
        priceFileHandle = handle;
        priceJsonDisconnected.style.display = "none";
        priceFileStatus.textContent =
            "Loaded " + products.length + " items from " + file.name + ".";
    } catch (error) {
        console.error(error);
        throw error;
    }
}

function validateProducts(value) {
    if (!Array.isArray(value) || value.some(product =>
        !product ||
        !Number.isSafeInteger(product.id) ||
        product.id < 1 ||
        typeof product.name !== "string" ||
        !product.name.trim() ||
        !Number.isFinite(Number(product.price)) ||
        Number(product.price) < 0
    )) {
        throw new Error("The selected file must contain a valid product list.");
    }

    const ids = value.map(product => product.id);
    if (new Set(ids).size !== ids.length) {
        throw new Error("The selected file contains duplicate product IDs.");
    }
}

// Display all products
function displayProducts(items) {
    const list = document.getElementById("productList");

    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = "<p>No products found.</p>";
        return;
    }

    items.forEach(product => {
        const div = document.createElement("div");

        div.className = "product";

        const name = document.createElement("strong");
        name.classList.add("itemName")
        name.textContent = product.name;

        const price = document.createElement("span");
        price.textContent = "₹" + Number(product.price).toFixed(2);

        const button = document.createElement("button");
        button.textContent = "Add +";
        button.onclick = () => addToCart(product.id);

        div.append(name, price, button);
        list.appendChild(div);
    });
}

// Search products
document.getElementById("search").addEventListener("input", function () {
    const value = this.value.toLowerCase();

    const filtered = products.filter(product =>
        product.name.toLowerCase().includes(value)
    );

    displayProducts(filtered);
});

// Add item to cart
function addToCart(id) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    const existing = cart.find(item => item.id === id);

    if (existing) {
        existing.qty++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            qty: 1
        });
    }

    displayCart();
}

// Increase quantity
function increaseQty(id) {
    const item = cart.find(p => p.id === id);

    if (item) {
        item.qty++;
    }

    displayCart();
}

// Decrease quantity
function decreaseQty(id) {
    const item = cart.find(p => p.id === id);

    if (!item) return;

    item.qty--;

    if (item.qty <= 0) {
        cart = cart.filter(p => p.id !== id);
    }

    displayCart();
}

// Remove item
function removeItem(id) {
    cart = cart.filter(p => p.id !== id);
    displayCart();
}

// Display cart
function displayCart() {
    const tbody = document.getElementById("cartItems");

    tbody.innerHTML = "";

    cart.forEach(item => {
        const tr = document.createElement("tr");

        const values = [
            item.name,
            "₹" + item.price.toFixed(2),
            null,
            "₹" + (item.price * item.qty).toFixed(2),
            null
        ];

        values.forEach((value, index) => {
            const td = document.createElement("td");

            if (index === 0) {
                td.classList.add("itemName")
                const fullName = String(value);
                const characters = Array.from(fullName);
                td.textContent = characters.length > 20
                    ? characters.slice(0, 20).join("") + "…"
                    : fullName;
                td.title = fullName;
            } else if (index === 2) {
                const minus = document.createElement("button");
                minus.textContent = "-";
                minus.className = "qty-btn";
                minus.onclick = () => decreaseQty(item.id);

                const quantity = document.createTextNode(" " + item.qty + " ");

                const plus = document.createElement("button");
                plus.textContent = "+";
                plus.className = "qty-btn";
                plus.onclick = () => increaseQty(item.id);

                td.append(minus, quantity, plus);

            } else if (index === 4) {
                const remove = document.createElement("button");
                remove.textContent = "X";
                remove.className = "remove-btn";
                remove.onclick = () => removeItem(item.id);

                td.appendChild(remove);

            } else {
                td.textContent = value;
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    updateTotal();
}

// Calculate grand total
function updateTotal() {
    const total = cart.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
    );

    document.getElementById("grandTotal").textContent =
        total.toFixed(2);
}

// Clear cart
function clearCart() {
    if(cart?.length) {
        document.getElementById("confirmPopup").style.display = "flex";
    }
}

// Close popup
function closePopup() {
    document.getElementById("confirmPopup").style.display = "none";
}

// Confirm and clear cart
function confirmClearCart() {
    cart = [];
    displayCart();
    // document.getElementById("invoice").innerHTML = ""
    // document.getElementById("invoice").style = "display:none;"
    closePopup();
}

// Generate invoice
function generateBill() {
    if (cart.length === 0) {
        return;
    }

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
    );

    const invoice = document.getElementById("invoice");

    const date = new Date().toLocaleString("en-IN");

    pendingInvoice = {
        id: "INV-" + Date.now(),
        date: date,
        total: total,
        saved: false,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty
        }))
    };

    const rows = cart.map(item => `
        <tr>
            <td class="itemName">${escapeHTML(item.name)}</td>
            <td>₹${item.price.toFixed(2)}</td>
            <td>${item.qty}</td>
            <td>₹${(item.price * item.qty).toFixed(2)}</td>
        </tr>
    `).join("");

    invoice.innerHTML = `
        <h2>MY SHOP</h2>
        <p style="text-align:center">Customer Invoice</p>
        <hr>

        <p><strong>Invoice Date:</strong> ${date}</p>

        <table>
            <thead>
                <tr>
                    <th>Item Name</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Amount</th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>

        <div class="invoice-total">
            <h2>Grand Total: ₹${total.toFixed(2)}</h2>
        </div>

        <hr>
        <p style="text-align:center">
            Thank You! Visit Again.
        </p>

        <p id="printBillBtn" style="text-align:center">
            <button onclick="window.print()">Print Bill</button>
        </p>
    `;

    invoice.style.display = "block";

    window.focus();
    window.print();
    printAndSaveBill();
}

// Escape product names before inserting into invoice HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ============================================
// EXCEL CONNECTION + BILLING HISTORY
// ============================================

let excelFileHandle = null;
let pendingInvoice = null;

const DB_NAME = "BillingExcelDB";
const STORE_NAME = "fileHandles";


// OPEN DATABASE
function openExcelDB() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = function () {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

    });
}


// SAVE FILE HANDLE
async function saveExcelHandle(handle) {

    const db = await openExcelDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(STORE_NAME, "readwrite");

        transaction.objectStore(STORE_NAME).put(
            handle,
            "productsExcel"
        );

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


// RESTORE FILE HANDLE
async function getSavedExcelHandle() {

    const db = await openExcelDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(STORE_NAME, "readonly");

        const request = transaction
            .objectStore(STORE_NAME)
            .get("productsExcel");

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


// CONNECT EXCEL FILE
async function connectExcelFile() {

    try {

        if (!window.showOpenFilePicker) {
            alert("Please use desktop Chrome or Edge.");
            return;
        }

        const [handle] = await window.showOpenFilePicker({

            multiple: false,

            types: [{
                description: "Excel Workbook",
                accept: {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                        [".xlsx"]
                }
            }]

        });

        excelFileHandle = handle;

        const permission = await handle.requestPermission({
            mode: "readwrite"
        });

        if (permission !== "granted") {
            alert("Excel write permission not granted.");
            return;
        }

        await saveExcelHandle(handle);

        document.getElementById("excelStatus").textContent =
            "Connected: " + handle.name;
        
            
        document.getElementById("excelDisconnected").style = "display:none;"
        


        // alert("Excel connected successfully!");

    } catch (error) {

        if (error.name !== "AbortError") {
            console.error(error);
            alert("Unable to connect Excel.");
        }

    }
}


// RESTORE CONNECTION ON PAGE LOAD
async function restoreExcelConnection() {

    const disconnected = document.getElementById("excelDisconnected");

    try {

        excelFileHandle = await getSavedExcelHandle();

        if (!excelFileHandle) {
            disconnected.style.display = "block";
            return;
        }

        const permission = await excelFileHandle.queryPermission({
            mode: "readwrite"
        });

        if (permission === "granted") {

            disconnected.style.display = "none";

        } else {

            disconnected.style.display = "block";

        }

    } catch (error) {

        console.error(error);

        disconnected.style.display = "block";

    }

}


// GET EXCEL WRITE PERMISSION
async function getExcelPermission() {

    if (!excelFileHandle) {
        excelFileHandle = await getSavedExcelHandle();
    }

    if (!excelFileHandle) {
        throw new Error("Excel file is not connected.");
    }

    let permission = await excelFileHandle.queryPermission({
        mode: "readwrite"
    });

    if (permission !== "granted") {

        permission = await excelFileHandle.requestPermission({
            mode: "readwrite"
        });

    }

    if (permission !== "granted") {
        throw new Error("Excel permission denied.");
    }

    return excelFileHandle;
}


// WRITE WORKBOOK
async function writeExcelWorkbook(invoice = null) {

    const handle = await getExcelPermission();

    // Read existing workbook
    const file = await handle.getFile();

    const buffer = await file.arrayBuffer();

    const workbook = buffer.byteLength
        ? XLSX.read(buffer, { type: "array" })
        : XLSX.utils.book_new();


    // --------------------------------
    // PRODUCTS SHEET
    // --------------------------------

    const productSheet = XLSX.utils.json_to_sheet(products);

    if (workbook.SheetNames.includes("Products")) {

        workbook.Sheets["Products"] = productSheet;

    } else {

        XLSX.utils.book_append_sheet(
            workbook,
            productSheet,
            "Products"
        );

    }


    // --------------------------------
    // BILLING HISTORY SHEET
    // --------------------------------

    if (invoice) {

        const sheetName = "Billing History";

        let historySheet;

        if (workbook.SheetNames.includes(sheetName)) {

            historySheet = workbook.Sheets[sheetName];

        } else {

            historySheet = XLSX.utils.aoa_to_sheet([]);

            XLSX.utils.book_append_sheet(
                workbook,
                historySheet,
                sheetName
            );

        }

        const headers = [
            "Invoice ID",
            "Invoice Date",
            "Product ID",
            "Product Name",
            "Price",
            "Quantity",
            "Amount",
            "Grand Total"
        ];

        const existingRows = XLSX.utils.sheet_to_json(
            historySheet,
            { header: 1 }
        );

        if (existingRows.length === 0) {

            XLSX.utils.sheet_add_aoa(
                historySheet,
                [headers],
                { origin: "A1" }
            );

        }

        const rows = invoice.items.map(item => [

            invoice.id,
            invoice.date,
            item.id,
            item.name,
            item.price,
            item.qty,
            item.price * item.qty,
            invoice.total

        ]);

        XLSX.utils.sheet_add_aoa(
            historySheet,
            rows,
            { origin: -1 }
        );

    }


    // --------------------------------
    // SAVE SAME EXCEL FILE
    // --------------------------------

    const updatedExcel = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array"
    });

    const writable = await handle.createWritable();

    try {

        await writable.write(updatedExcel);
        await writable.close();

    } catch (error) {

        await writable.abort();
        throw error;

    }

}


// SYNC PRODUCTS TO EXCEL
async function syncProductsToExcel() {

    try {

        await writeExcelWorkbook();

        document.getElementById("excelStatus").textContent =
            "Products successfully synchronized.";

        // alert("Products updated in Excel successfully!");

    } catch (error) {

        console.error(error);

        alert("Excel update failed: " + error.message);

    }

}


// ============================================
// PRINT BILL + AUTOMATIC EXCEL SAVE
// ============================================


async function printAndSaveBill() {

    if (!pendingInvoice) {
        return;
    }

    if (pendingInvoice.saved) {
        return;
    }

    try {

        await writeExcelWorkbook(pendingInvoice);

        pendingInvoice.saved = true;

    } catch (error) {

        console.error("Excel save error:", error);
        alert("Invoice printed, but Excel saving failed: " + error.message);

    }

}



// RESTORE CONNECTION
restoreExcelConnection();



// ============================================
// SHOW ALL TRANSACTIONS FROM EXCEL
// ============================================

async function showTransactions() {

    const container = document.getElementById(
        "transactionContainer"
    );

    const tbody = document.getElementById(
        "transactionBody"
    );

    const status = document.getElementById(
        "transactionStatus"
    );

    container.style.display = "block";

    tbody.innerHTML = "";

    status.textContent = "Loading transactions...";

    try {

        // Get connected Excel file
        const handle = await getExcelPermission();

        // Read Excel workbook
        const file = await handle.getFile();

        const buffer = await file.arrayBuffer();

        const workbook = XLSX.read(buffer, {
            type: "array"
        });

        // Check Billing History sheet
        if (!workbook.SheetNames.includes("Billing History")) {

            status.textContent =
                "No Billing History sheet found in Excel.";

            return;
        }

        const worksheet = workbook.Sheets["Billing History"];

        // Convert Excel sheet into JSON
        const transactions = XLSX.utils.sheet_to_json(
            worksheet,
            {
                defval: ""
            }
        );

        if (transactions.length === 0) {

            status.textContent = "No transactions found.";

            return;
        }

        // Display transaction records
        transactions.forEach((transaction, index) => {

            const tr = document.createElement("tr");

            const values = [
                index+1,
                transaction["Invoice ID"],
                transaction["Invoice Date"],
                transaction["Product ID"],
                transaction["Product Name"],
                "₹" + Number(transaction["Price"] || 0).toFixed(2),
                transaction["Quantity"],
                "₹" + Number(transaction["Amount"] || 0).toFixed(2),
                "₹" + Number(transaction["Grand Total"] || 0).toFixed(2)
            ];

            values.forEach(value => {

                const td = document.createElement("td");

                td.textContent = value ?? "";

                tr.appendChild(td);

            });

            tbody.appendChild(tr);

        });

        status.textContent =
            "Total transaction records: " + transactions.length;

    } catch (error) {

        console.error(error);

        status.textContent =
            "Unable to read transactions: " + error.message;

    }

}


// ============================================
// HIDE TRANSACTIONS
// ============================================

function hideTransactions() {

    document.getElementById(
        "transactionContainer"
    ).style.display = "none";

}


// ============================================
// DOWNLOAD ALL TRANSACTIONS AS PDF
// ============================================

async function downloadAllTransactions() {

    const status = document.getElementById("transactionStatus");

    try {

        if (!window.jspdf) {
            throw new Error("PDF library failed to load.");
        }

        if (typeof status !== "undefined" && status) {
            status.textContent = "Preparing transaction PDF...";
        }

        const handle = await getExcelPermission();
        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        if (!workbook.SheetNames.includes("Billing History")) {
            throw new Error("No Billing History sheet found in Excel.");
        }

        const worksheet = workbook.Sheets["Billing History"];
        const transactions = XLSX.utils.sheet_to_json(
            worksheet,
            { defval: "" }
        );

        if (transactions.length === 0) {
            throw new Error("No transactions found.");
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("All Billing Transactions", 14, 15);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
            "Generated: " + new Date().toLocaleString("en-IN"),
            14,
            22
        );

        const rows = transactions.map((transaction, index) => [
            index+1,
            transaction["Invoice ID"] ?? "",
            transaction["Invoice Date"] ?? "",
            transaction["Product ID"] ?? "",
            transaction["Product Name"] ?? "",
            (transaction["Price"]),
            transaction["Quantity"] ?? "",
            (transaction["Amount"]),
            (transaction["Grand Total"])
        ]);

        doc.autoTable({
            startY: 28,
            head: [[
                "#",
                "Invoice ID",
                "Invoice Date",
                "Product ID",
                "Product Name",
                "Price",
                "Qty",
                "Amount",
                "Grand Total"
            ]],
            body: rows,
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            headStyles: {
                fillColor: [23, 37, 84]
            },
            alternateRowStyles: {
                fillColor: [242, 244, 248]
            },
            margin: {
                top: 28,
                left: 14,
                right: 14
            }
        });

        doc.save("all-transactions-" +
            new Date().toISOString().slice(0, 10) + ".pdf");

        if (typeof status !== "undefined" && status) {
            status.textContent =
                "PDF downloaded. Total transaction records: " +
                transactions.length;
        }

    } catch (error) {

        console.error(error);

        const status = document.getElementById(
            "transactionStatus"
        );

        if (status) {
            status.textContent =
                "Unable to download PDF: " + error.message;
        } else {
            alert("Unable to download PDF: " + error.message);
        }

    }

}
