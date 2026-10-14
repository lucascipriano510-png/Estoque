class StockApp {
    constructor() {
        this.categories = ['Camisas G', 'Camisas M', 'Calças 38', 'Bonés', 'Óculos'];
        this.products = [];

        this.currentCategory = 'todos';
        this.searchTerm = '';
        
        this.currentStep = 1;
        this.activeProduct = null;
        this.productToDeleteId = null;
        this.selectedQuantity = 1;
        this.actionType = 'baixa';
        this.tempImageFile = null;

        this.batchFiles = [];

        this.init();
    }

    async init() {
        await this.loadFromFirebase();
        this.renderCategories();
        this.renderCatalog();
    }

    async loadFromFirebase() {
        try {
            if (!window.db) return;
            const { collection, getDocs } = window.fbMethods;
            
            const prodSnapshot = await getDocs(collection(window.db, 'products'));
            if (!prodSnapshot.empty) {
                this.products = prodSnapshot.docs.map(doc => doc.data());
            }

            const catSnapshot = await getDocs(collection(window.db, 'categories'));
            if (!catSnapshot.empty) {
                this.categories = catSnapshot.docs.map(doc => doc.data().name);
            }
        } catch (e) {
            console.error("Erro ao carregar do Firebase:", e);
        }
    }

    async saveProductToDB(product) {
        try {
            if (!window.db) return;
            const { doc, setDoc } = window.fbMethods;
            await setDoc(doc(window.db, 'products', String(product.id)), product);
        } catch (e) {
            console.error('Erro ao salvar produto no Firestore:', e);
        }
    }

    async saveCategoriesToDB() {
        try {
            if (!window.db) return;
            const { doc, setDoc } = window.fbMethods;
            for (let cat of this.categories) {
                await setDoc(doc(window.db, 'categories', cat), { name: cat });
            }
        } catch (e) {
            console.error('Erro ao salvar categorias:', e);
        }
    }

    async uploadImageToStorage(file, productId) {
        if (!file || typeof file === 'string') return file;
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve('https://placehold.co/400x400/1e293b/94a3b8?text=Sem+Foto');
            reader.readAsDataURL(file);
        });
    }

    renderCategories() {
        const container = document.getElementById('categoryTabs');
        if (!container) return;
        
        let html = `
            <button onclick="app.setCategory('todos')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                this.currentCategory === 'todos' 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' 
                : 'bg-slate-800 text-slate-400 border-slate-700/80 hover:bg-slate-750 hover:text-slate-200'
            }">
                Todos
            </button>
        `;

        this.categories.forEach(cat => {
            const active = this.currentCategory === cat;
            html += `
                <button onclick="app.setCategory('${cat}')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                    active 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' 
                    : 'bg-slate-800 text-slate-400 border-slate-700/80 hover:bg-slate-750 hover:text-slate-200'
                }">
                    ${cat}
                </button>
            `;
        });

        container.innerHTML = html;
    }

    setCategory(cat) {
        this.currentCategory = cat;
        this.renderCategories();
        this.renderCatalog();
    }

    handleSearch(term) {
        this.searchTerm = term.toLowerCase().trim();
        this.renderCatalog();
    }

    renderCatalog() {
        const grid = document.getElementById('catalogGrid');
        const emptyMsg = document.getElementById('emptyCatalogMessage');
        if (!grid) return;

        const filtered = this.products.filter(p => {
            const matchesCategory = this.currentCategory === 'todos' || p.category === this.currentCategory;
            const matchesSearch = p.name.toLowerCase().includes(this.searchTerm) || p.code.toLowerCase().includes(this.searchTerm);
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (emptyMsg) emptyMsg.classList.remove('hidden');
            return;
        }

        if (emptyMsg) emptyMsg.classList.add('hidden');

        grid.innerHTML = filtered.map(p => {
            let stockBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            if (p.stock <= 3) stockBadgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            else if (p.stock <= 8) stockBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';

            return `
                <div class="group bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden hover:border-indigo-500/60 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col relative">
                    <div onclick="app.startStep1(${p.id})" class="relative aspect-square bg-slate-900 overflow-hidden cursor-pointer">
                        <img src="${p.image}" alt="${p.name}" onerror="this.src='https://placehold.co/400x400/1e293b/94a3b8?text=Sem+Foto'" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        <div class="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur-md ${stockBadgeColor}">
                            Est: ${p.stock}
                        </div>
                        <div class="absolute bottom-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-300 border border-slate-700">
                            ${p.code}
                        </div>
                    </div>

                    <button onclick="app.openEditProductModal(${p.id})" title="Alterar foto ou dados" class="absolute top-2.5 left-2.5 bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-indigo-400 p-2 rounded-xl backdrop-blur-md border border-slate-700 transition z-10">
                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                    </button>

                    <button onclick="app.deleteProduct(event, ${p.id})" title="Excluir produto" class="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-rose-400 p-2 rounded-xl backdrop-blur-md border border-slate-700 transition z-10">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>

                    <div onclick="app.startStep1(${p.id})" class="p-3 sm:p-4 flex-1 flex flex-col justify-between cursor-pointer">
                        <div>
                            <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">${p.category}</span>
                            <h3 class="text-xs sm:text-sm font-semibold text-slate-100 truncate mt-0.5">${p.name}</h3>
                        </div>
                        <div class="mt-2 flex items-center justify-between">
                            <span class="text-xs sm:text-sm font-bold text-indigo-400">R$ ${p.price.toFixed(2).replace('.', ',')}</span>
                            <span class="text-[10px] text-slate-400 font-medium group-hover:text-indigo-300 transition">Ajustar &rarr;</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    openBatchModal() {
        this.batchFiles = [];
        const badge = document.getElementById('batchCountBadge');
        if (badge) badge.classList.add('hidden');
        document.getElementById('batchNamePrefix').value = '';
        document.getElementById('batchPrice').value = '';
        document.getElementById('batchStock').value = '1';
        
        this.populateCategorySelect('batchCategorySelect');
        const modal = document.getElementById('batchModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeBatchModal() {
        const modal = document.getElementById('batchModal');
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }

    handleBatchSelect(event) {
        this.batchFiles = Array.from(event.target.files);
        const badge = document.getElementById('batchCountBadge');
        const text = document.getElementById('batchCountText');

        if (this.batchFiles.length > 0) {
            text.innerHTML = `<i class="fa-solid fa-images mr-1"></i> ${this.batchFiles.length} foto(s) selecionada(s)`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    async processBatchUpload(e) {
        e.preventDefault();
        if (this.batchFiles.length === 0) {
            alert('Por favor, selecione pelo menos uma foto.');
            return;
        }

        const category = document.getElementById('batchCategorySelect').value;
        const prefixInput = document.getElementById('batchNamePrefix').value.trim();
        const prefix = prefixInput || category;
        const price = parseFloat(document.getElementById('batchPrice').value) || 0;
        const stock = parseInt(document.getElementById('batchStock').value) || 1;

        const btn = document.getElementById('btnSubmitBatch');
        if (btn) btn.disabled = true;

        const total = this.batchFiles.length;

        for (let i = 0; i < total; i++) {
            if (btn) btn.innerText = `Enviando ${i + 1} de ${total}...`;
            const file = this.batchFiles[i];
            const uniqueId = Date.now() + i;
            
            const imageUrl = await this.uploadImageToStorage(file, uniqueId);
            
            const randomRef = Math.floor(1000 + Math.random() * 9000);
            const newProd = {
                id: uniqueId,
                name: `${prefix} #${i + 1}`,
                code: `REF-${randomRef}`,
                price: price,
                category: category,
                stock: stock,
                image: imageUrl
            };

            this.products.unshift(newProd);
            await this.saveProductToDB(newProd);
        }

        this.renderCatalog();
        this.closeBatchModal();

        if (btn) {
            btn.disabled = false;
            btn.innerText = "Importar Lote";
        }
    }

    deleteProduct(event, productId) {
        if (event) event.stopPropagation();
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        this.productToDeleteId = productId;
        document.getElementById('deleteConfirmText').innerText = `Tem certeza que deseja apagar "${prod.name}" (${prod.code})? Esta ação não pode ser desfeita.`;
        
        const modal = document.getElementById('deleteConfirmModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeDeleteModal() {
        this.productToDeleteId = null;
        const modal = document.getElementById('deleteConfirmModal');
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }

    async confirmDeleteProduct() {
        if (!this.productToDeleteId) return;
        try {
            if (window.db) {
                const { doc, deleteDoc } = window.fbMethods;
                await deleteDoc(doc(window.db, 'products', String(this.productToDeleteId)));
            }
            this.products = this.products.filter(p => p.id !== this.productToDeleteId);
            this.renderCatalog();
        } catch (e) {
            console.error("Erro ao excluir do Firebase:", e);
        }
        this.closeDeleteModal();
    }

    startStep1(productId) {
        this.activeProduct = this.products.find(p => p.id === productId);
        if (!this.activeProduct) return;

        this.currentStep = 1;
        this.selectedQuantity = 1;
        this.actionType = 'baixa';
        this.setActionType('baixa');

        document.getElementById('step1Image').src = this.activeProduct.image;
        document.getElementById('step1Name').innerText = this.activeProduct.name;
        document.getElementById('step1Code').innerText = `Cód: #${this.activeProduct.code}`;
        document.getElementById('step1Category').innerText = this.activeProduct.category;
        document.getElementById('step1Price').innerText = `R$ ${this.activeProduct.price.toFixed(2).replace('.', ',')}`;
        document.getElementById('step1Stock').innerText = `${this.activeProduct.stock} unidades`;

        this.updateStepUI();
        const modal = document.getElementById('stepModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    setActionType(type) {
        this.actionType = type;
        const btnBaixa = document.getElementById('btnActionBaixa');
        const btnEntrada = document.getElementById('btnActionEntrada');
        if (!btnBaixa || !btnEntrada) return;

        if (type === 'baixa') {
            btnBaixa.className = "py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-rose-500/20 text-rose-300 border-rose-500/40";
            btnEntrada.className = "py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-slate-700/50 text-slate-400 border-slate-600";
        } else {
            btnEntrada.className = "py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
            btnBaixa.className = "py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-slate-700/50 text-slate-400 border-slate-600";
        }
    }

    adjustQuantity(delta) {
        const newQty = this.selectedQuantity + delta;
        if (newQty >= 1) {
            this.selectedQuantity = newQty;
            const display = document.getElementById('selectedQtyDisplay');
            if (display) display.innerText = this.selectedQuantity;
        }
    }

    updateStepUI() {
        const badge = document.getElementById('stepBadge');
        const title = document.getElementById('modalStepTitle');
        const content1 = document.getElementById('step1Content');
        const content2 = document.getElementById('step2Content');
        const content3 = document.getElementById('step3Content');
        const btnPrev = document.getElementById('btnPrevStep');
        const btnNext = document.getElementById('btnNextStep');

        if (!content1 || !content2 || !content3) return;

        content1.classList.add('hidden');
        content2.classList.add('hidden');
        content3.classList.add('hidden');

        if (this.currentStep === 1) {
            if (badge) badge.innerText = "Etapa 1 de 3";
            if (title) title.innerText = "Detalhes do Produto";
            content1.classList.remove('hidden');
            if (btnPrev) btnPrev.classList.add('hidden');
            if (btnNext) btnNext.innerText = "Avançar para Ajuste (Etapa 2)";
        } else if (this.currentStep === 2) {
            if (badge) badge.innerText = "Etapa 2 de 3";
            if (title) title.innerText = "Quantidade e Operação";
            content2.classList.remove('hidden');
            const step2Img = document.getElementById('step2Image');
            const step2Name = document.getElementById('step2Name');
            const qtyDisp = document.getElementById('selectedQtyDisplay');
            if (step2Img) step2Img.src = this.activeProduct.image;
            if (step2Name) step2Name.innerText = this.activeProduct.name;
            if (qtyDisp) qtyDisp.innerText = this.selectedQuantity;
            if (btnPrev) btnPrev.classList.remove('hidden');
            if (btnNext) btnNext.innerText = "Ir para Resumo (Etapa 3)";
        } else if (this.currentStep === 3) {
            if (badge) badge.innerText = "Etapa 3 de 3";
            if (title) title.innerText = "Confirmação";
            content3.classList.remove('hidden');

            const isBaixa = this.actionType === 'baixa';
            const newStockCalculated = isBaixa 
                ? Math.max(0, this.activeProduct.stock - this.selectedQuantity)
                : this.activeProduct.stock + this.selectedQuantity;

            const sumName = document.getElementById('summaryName');
            const sumAction = document.getElementById('summaryAction');
            const sumQty = document.getElementById('summaryQty');
            const sumNewStock = document.getElementById('summaryNewStock');

            if (sumName) sumName.innerText = this.activeProduct.name;
            if (sumAction) {
                sumAction.innerText = isBaixa ? "Dar Baixa (-)" : "Entrada (+)";
                sumAction.className = isBaixa ? "font-bold text-rose-400" : "font-bold text-emerald-400";
            }
            if (sumQty) sumQty.innerText = `${this.selectedQuantity} unidade(s)`;
            if (sumNewStock) sumNewStock.innerText = `${newStockCalculated} unidades`;

            if (btnPrev) btnPrev.classList.remove('hidden');
            if (btnNext) btnNext.innerText = "Confirmar e Concluir";
        }
    }

    async nextStep() {
        if (this.currentStep < 3) {
            this.currentStep++;
            this.updateStepUI();
        } else {
            const isBaixa = this.actionType === 'baixa';
            if (isBaixa) {
                this.activeProduct.stock = Math.max(0, this.activeProduct.stock - this.selectedQuantity);
            } else {
                this.activeProduct.stock += this.selectedQuantity;
            }

            await this.saveProductToDB(this.activeProduct);
            this.renderCatalog();
            this.closeStepModal();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepUI();
        }
    }

    closeStepModal() {
        const modal = document.getElementById('stepModal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }

    openAddProductModal() {
        const editId = document.getElementById('editProductId');
        const modalTitle = document.getElementById('productModalTitle');
        const form = document.getElementById('productForm');
        const imgPrev = document.getElementById('imagePreview');

        if (editId) editId.value = '';
        if (modalTitle) modalTitle.innerText = 'Cadastrar Novo Produto';
        if (form) form.reset();
        this.tempImageFile = null;
        if (imgPrev) imgPrev.src = 'https://placehold.co/400x400/1e293b/94a3b8?text=Clique+p/+foto';
        
        this.populateCategorySelect('prodCategorySelect');
        const modal = document.getElementById('addProductModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    openEditProductModal(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        document.getElementById('editProductId').value = prod.id;
        document.getElementById('productModalTitle').innerText = 'Editar Produto / Trocar Foto';
        document.getElementById('prodName').value = prod.name;
        document.getElementById('prodCode').value = prod.code;
        document.getElementById('prodPrice').value = prod.price;
        document.getElementById('prodStock').value = prod.stock;

        this.tempImageFile = prod.image;
        document.getElementById('imagePreview').src = prod.image;

        this.populateCategorySelect('prodCategorySelect', prod.category);
        const modal = document.getElementById('addProductModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    populateCategorySelect(targetElementId, selectedCategory = '') {
        const select = document.getElementById(targetElementId);
        if (!select) return;

        select.innerHTML = this.categories.map(c => 
            `<option value="${c}" ${c === selectedCategory ? 'selected' : ''}>${c}</option>`
        ).join('');
    }

    closeAddModal() {
        const modal = document.getElementById('addProductModal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.tempImageFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                const prev = document.getElementById('imagePreview');
                if (prev) prev.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    async saveProduct(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();

        const btnSubmit = document.querySelector('#productForm button[type="submit"]') || e?.submitter;
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "A guardar...";
        }

        try {
            const editId = document.getElementById('editProductId').value;
            const name = document.getElementById('prodName').value.trim();
            const code = document.getElementById('prodCode').value.trim();
            const price = parseFloat(document.getElementById('prodPrice').value) || 0;
            const category = document.getElementById('prodCategorySelect').value;
            const stock = parseInt(document.getElementById('prodStock').value) || 0;

            if (!name || !code) {
                alert('Preencha o nome e o código do produto.');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = "Salvar Produto";
                }
                return;
            }
            
            let productId = editId ? parseInt(editId) : Date.now();
            
            let imageUrl = 'https://placehold.co/400x400/1e293b/94a3b8?text=Sem+Foto';
            if (this.tempImageFile) {
                imageUrl = await this.uploadImageToStorage(this.tempImageFile, productId);
            } else {
                const imgPrev = document.getElementById('imagePreview');
                if (imgPrev) imageUrl = imgPrev.src;
            }

            const productData = {
                id: productId,
                name,
                code,
                price,
                category,
                stock,
                image: imageUrl
            };

            if (editId) {
                const index = this.products.findIndex(p => p.id === productId);
                if (index !== -1) {
                    this.products[index] = productData;
                }
            } else {
                this.products.unshift(productData);
            }

            await this.saveProductToDB(productData);
            this.renderCatalog();
            this.closeAddModal();

        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            alert("Ocorreu um erro ao salvar. Tente novamente.");
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Salvar Produto";
            }
        }
    }

    openCategoryListModal() {
        this.renderCategoriesListModal();
        const modal = document.getElementById('categoryModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    closeCategoryModal() {
        const modal = document.getElementById('categoryModal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }

    renderCategoriesListModal() {
        const container = document.getElementById('categoryListContainer');
        if (!container) return;

        container.innerHTML = this.categories.map(cat => `
            <div class="flex items-center justify-between bg-slate-900 border border-slate-700/80 px-3 py-2 rounded-xl">
                <span class="font-medium text-slate-200">${cat}</span>
                <button onclick="app.deleteCategory('${cat}')" class="text-slate-500 hover:text-rose-400 p-1 transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `).join('');
    }

    async addCategory() {
        const input = document.getElementById('newCategoryInput');
        if (!input) return;
        const val = input.value.trim();
        if (val && !this.categories.includes(val)) {
            this.categories.push(val);
            input.value = '';
            await this.saveCategoriesToDB();
            this.renderCategories();
            this.renderCategoriesListModal();
        }
    }

    async deleteCategory(cat) {
        this.categories = this.categories.filter(c => c !== cat);
        if (this.currentCategory === cat) this.currentCategory = 'todos';
        
        try {
            if (window.db) {
                const { doc, deleteDoc } = window.fbMethods;
                await deleteDoc(doc(window.db, 'categories', cat));
            }
        } catch (e) {
            console.error("Erro ao apagar categoria:", e);
        }

        this.renderCategories();
        this.renderCategoriesListModal();
        this.renderCatalog();
    }
}

let app;
window.onload = () => {
    app = new StockApp();
};
