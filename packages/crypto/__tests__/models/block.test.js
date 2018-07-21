const ByteBuffer = require('bytebuffer')
const Block = require('../../lib/models/block')

describe('Models - Block', () => {
  const data = {
    id: '187940162505562345',
    blockSignature: '3045022100a6605198e0f590c88798405bc76748d84e280d179bcefed2c993e70cded2a5dd022008c7f915b89fc4f3250fc4b481abb753c68f30ac351871c50bd6cfaf151370e8', // eslint-disable-line max-len
    generatorPublicKey: '024c8247388a02ecd1de2a3e3fd5b7c61ecc2797fa3776599d558333ef1802d231',
    height: 10,
    numberOfTransactions: 0,
    payloadHash: '578e820911f24e039733b45e4882b73e301f813a0d2c31330dafda84534ffa23',
    payloadLength: 1,
    previousBlock: '12123',
    reward: 1,
    timestamp: 111150,
    totalAmount: 10,
    totalFee: 1,
    transactions: [],
    version: 6
  }

  describe('constructor', () => {
    xit('stores the data', () => {})
    xit('verifies the block', () => {})
  })

  describe('getHeader', () => {
    it('returns the block data without the transactions', () => {
      // Ignore the verification for testing purposes
      jest.spyOn(Block.prototype, 'verify').mockImplementation(() => ({ verified: true }))

      const data2 = { ...data }
      const header = (new Block(data2)).getHeader()

      Object.keys(data).forEach(key => {
        if (key !== 'transactions') {
          expect(header[key]).toEqual(data2[key])
        }
      })

      expect(header).not.toHaveProperty('transactions')
    })
  })

  describe('serialize', () => {
    const serialize = (data, includeSignature) => {
      const serialized = Block.serialize(data, includeSignature)
      const buffer = new ByteBuffer(1024, true)
      buffer.append(serialized)
      buffer.flip()
      return buffer
    }

    it('version is serialized as a TODO', () => {
      expect(serialize(data).readUInt32(0)).toEqual(data.version)
    })

    it('timestamp is serialized as a UInt32', () => {
      expect(serialize(data).readUInt32(4)).toEqual(data.timestamp)
    })

    it('height is serialized as a UInt32', () => {
      expect(serialize(data).readUInt32(8)).toEqual(data.height)
    })

    describe('if `previousBlockHex` exists', () => {
      it('is serialized as hexadecimal', () => {
        const data2 = { ...data, ...{ previousBlockHex: 'a00000000000000a' } }
        expect(serialize(data2).slice(12, 20).toString('hex')).toEqual(data2.previousBlockHex)
      })
    })

    describe('if `previousBlockHex` does not exist', () => {
      it('8 bytes are added, as padding', () => {
        expect(serialize(data).slice(12, 20).toString('hex')).toEqual('0000000000000000')
      })
    })

    it('number of transactions is serialized as a UInt32', () => {
      expect(serialize(data).readUInt32(20)).toEqual(data.numberOfTransactions)
    })

    it('`totalAmount` of transactions is serialized as a UInt64', () => {
      expect(serialize(data).readUInt64(24).toNumber()).toEqual(data.totalAmount)
    })

    it('`totalFee` of transactions is serialized as a UInt64', () => {
      expect(serialize(data).readUInt64(32).toNumber()).toEqual(data.totalFee)
    })

    it('`reward` of transactions is serialized as a UInt64', () => {
      expect(serialize(data).readUInt64(40).toNumber()).toEqual(data.reward)
    })

    it('`payloadLength` of transactions is serialized as a UInt32', () => {
      expect(serialize(data).readUInt32(48)).toEqual(data.payloadLength)
    })

    it('`payloadHash` of transactions is appended, using 32 bytes, as hexadecimal', () => {
      expect(serialize(data).slice(52, 52 + 32).toString('hex')).toEqual(data.payloadHash)
    })

    it('`generatorPublicKey` of transactions is appended, using 33 bytes, as hexadecimal', () => {
      expect(serialize(data).slice(84, 84 + 33).toString('hex')).toEqual(data.generatorPublicKey)
    })

    describe('if the `blockSignature` is not included', () => {
      it('is not serialized', () => {
        const data2 = { ...data }
        delete data2.blockSignature
        expect(serialize(data2).limit).toEqual(117)
      })

      it('is not serialized, even when the `includeSignature` parameter is true', () => {
        const data2 = { ...data }
        delete data2.blockSignature
        expect(serialize(data2, true).limit).toEqual(117)
      })
    })

    describe('if the `blockSignature` is included', () => {
      it('is serialized', () => {
        expect(serialize(data).slice(117, 188).toString('hex')).toEqual(data.blockSignature)
      })

      it('is serialized unless the `includeSignature` parameter is false', () => {
        expect(serialize(data, false).limit).toEqual(117)
      })
    })

    describe('test blocks', () => {
      let serialiseds = [
        '00000000c85408015fc4150029b6af826e640cce020000001a458d1600000000002d31010000000000c2eb0b00000000400000002763ddc267de1adf1a0e1cf69b19d15c16894580330178ecfbd785c7b73161db02df70fa5cf1687438363c06f97f8e1b67bb565f77ded6988dd46d4456bfdaf4af304402206353051efc7b562aae5e100a4b2b4d1f9d7789b9c3a7dd8675edc7ddddc71f6e02204aff17470b390d7ff2c332e405bdd835f01121de5aec3c8fde23a7a3fb574adbb6000000c7000000ff011e00c25408010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001c676f6f736520726573657276652e207c74782062792061726b2d676fa505430000000000000000001e41ac3c020d83d8238a538de849089a0d392be489304502210096423bff6d99fba7664b860ffc39643f615caf3dedbd636aeb48089f970acd87022051d502022748b631b6b00a0e6818d96496c0fa796ad39d77e2089a252e730abeff011e00c25408010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000002d676f6f73653a20766f746572732073686172652e205468616e6b20796f7521207c74782062792061726b2d676f753f4a1600000000000000001ee51d5433e842b8f5393a9c9ba0a2cacf9e620d023045022100f6906fdad0e07f00ec6e6b5d2c1c38a823893b27dcc9291323a662a8cd5808a00220034a6e3e2dc382d7b36b97834dc4ba56363eab2c4cfc048a51828a679472962a',
        '00000000b0120c01173a160092b87bdc4850eb8103000000e0dcf30c0000000080c3c9010000000000c2eb0b0000000060000000101f4afd4dc88f1149a1d90d5298c218852e04cd95122e51d4fa31ebc80a8a1903794e95585ab18fd95c963cfb2ec24f37ad159f6a43e05dd826577b58a32de3093045022100d405bcab8e48866bdd81bc4ff311110a843ab862e0382ecc2b1784befb41585002201d6be7ab405069351775a24b53bfd647adb52a2f7a66f41102cfdfb4768173b7b9000000c6000000b4000000ff011e00a6120c010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0809698000000000020676f6f7365204465764e65742046756e642e207c74782062792061726b2d676fc1749d0100000000000000001e41ac3c020d83d8238a538de849089a0d392be489304402203354ae8cb3c1353e20bd51545ebdd4a04437dc5bcef251cbc41ecc514d7ef0b7022019a8dee2ea2e3cf760c84eb3be0261e47085b88949dba1d03a8edd9181a4ce01ff011e00a6120c010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000002d676f6f73653a20766f746572732073686172652e205468616e6b20796f7521207c74782062792061726b2d676fde89510a00000000000000001ee51d5433e842b8f5393a9c9ba0a2cacf9e620d0230440220511edb58fb45fa0e297afde97e446f045b599fcbfb957f2e7fd2fccd990eb26902205af32eb1f0d80e5c1dde36d34e8c5a94f0c1e36bc4b99a14cd819a90e0e30590ff011e00a6120c010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001c676f6f736520726573657276652e207c74782062792061726b2d676f41de040100000000000000001e41ac3c020d83d8238a538de849089a0d392be489304302202080fe9020b7eeb018e2c0187477af714243b089e1ab90924af54a80732a81eb021f3d3385e4a47f09142a37a02fa53096ffdf5a09c5330329687843f2379e06a4',
        '00000000a87f1501ca591700f640bdcc7c822639030000002667b30c0000000080c3c9010000000000c2eb0b0000000060000000648750fda993744468a26e253d6186e8d7d85230c67b23d4c8d95749bd91076e0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0304402204834295f96c1af91fb9e673315581417cb0bc5a4f5ad33b9768bef1f4f42250d02206307737b60bbdbc4afea082d20997f24de932140dcf66f8c09f7f84a7315f100ba000000c6000000b6000000ff011e008a7f15010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0809698000000000020676f6f7365204465764e65742046756e642e207c74782062792061726b2d676f7fc9930100000000000000001e41ac3c020d83d8238a538de849089a0d392be48930450221009a6fd7ed6a47bb652d3e4e2ce32ef79d91c43e45eb06b93ccafd29583f4660fc02205fc835c4697b8a73bb1f82247a6279003213e9e8b1213124fb83a400cfa5d446ff011e008a7f15010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000002d676f6f73653a20766f746572732073686172652e205468616e6b20796f7521207c74782062792061726b2d676fa86a240a00000000000000001ee51d5433e842b8f5393a9c9ba0a2cacf9e620d02304402201696335cca3631c4a7287f7b93ea5bdcf1f57109faee479ada4b093288a3a558022034786a509932a45be878ffce13c78aac356c995ed82d04a872de8323839820f1ff011e008a7f15010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001c676f6f736520726573657276652e207c74782062792061726b2d676fff32fb0000000000000000001e41ac3c020d83d8238a538de849089a0d392be4893045022100859589b1258904c475e7bba9c31bc38f58a58adc1bb28b576bb81ed5d420f60602203a1883a9e54a06e32a56e6e8f8992e387e00c76288bd23a6ce3bd320d1451803',
        '00000000c8291901b8c4170098a81ee52effe78806000000186e1c188a060000008793030000000000c2eb0b00000000c000000099ace34c0d0ee732d2f2f1a8289aacbed6c78338d522e7674c56572c028a0948028f0a25321cd9d3bf051b34a835cd5eee0125120c17654bc95790f8f2d970dc46304402203d277f68d6123d9f2caa17b65ab333b523b6ef4a8daf03efd79ad1604424882502204985f45c34a9fad2b517fefafa65293f47751516f1ea802996785ff396af84cab0000000a6000000a5000000b1000000a6000000b0000000ff011e00c029190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000016636872697320626f747c74782062792061726b2d676f3c9e8b1411000000000000001ed3348ec3a821e123661d40f92f876246a68023f23045022100812ad00f621472278a000685bb8086ab2e0fdabd091003a60aae370b90c81c3102206b6d6f6563cfb9ba12bf3d954891c308ce9aa98a6c293fcb93c227081499d2c3ff011e00c029190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c74782062792061726b2d676fcd3f500000000000000000001e035d21fa40b1e94e244c7eff7cb0c71cfa9e13c43045022100aa3550ecce4f5d2c8741177233717dc1ce35867291fb132eafdd87653fbba41902207eb50859d2a894dbf509c2c9acbacda417264d95da8a8850e76d8e9f641e0139ff011e00c029190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c74782062792061726b2d676f64769b0100000000000000001ed3348ec3a821e123661d40f92f876246a68023f23044022006732e562b2e50c4f156a12e08de8edea7e07cd3babe0b6c8c8a7cb60cd8bc91022035b8cf52935e701179747ad0e50060de02099f9c128bda478f2463ed90a6a20eff011e00c029190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000017636872697320626f74207c74782062792061726b2d676f3c9e8b1411000000000000001eb09c56caa5da3727181852feb4ec28437ee680f23045022100e2fe012c8183fd7081e04d50349442d605e8338157036a0cde4713ccd4f59b5802200a1d3a5d39aeeb64b1f5ddbfc6843888d07befe44823477a58f02bd62cde9917ff011e00c029190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c74782062792061726b2d676f434b1e0000000000000000001eb09c56caa5da3727181852feb4ec28437ee680f230450221008eaa41f5035a193c1922d50e8a79a6ab4760d205e25997d2b5318a3a98d887c802203e6034188c9fd1464a6e6f1a97e9c58e41de43761d8955349150dfdcb553fa05ff011e00c029190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000017636872697320626f74207c74782062792061726b2d676f2c30fbec67060000000000001ed421060ebd11f29b416a5802c55db49db93e27313044022056fd51a12ff65d5aa4b81b26d33f01c9411f74f814d3a1a6b78d47a8759da5a702206f2a20f94cd1d16ec0ebe71e9eba391d9c5e7ea2821a84e0e5d086bd19695fdb',
        '00000000902519013fc417007ce7a87ec4508b0c0c0000008ce4b60f00000000000e27070000000000c2eb0b00000000800100000e14663db43354388312960f3e83d2d39c10d1cc71d0bb7c377cb5641ff7d8eb02ce086b1e1609c691c0d2e0670a15248a7244195798bcc578b12133fe04defe593045022100de21b64ccff8e3b7cf24319e272cf8eac8508b16ccf504dd6d611c3bc32d68d402202e8b956e3c7a3e231ccc2fae0024dc9627db47b145ac4aad72565cc1be737871b6000000a6000000a6000000c7000000a6000000ba000000a5000000a5000000a5000000a5000000a6000000a5000000ff011e00862519010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001c676f6f736520726573657276652e207c74782062792061726b2d676f32ec6e0100000000000000001e41ac3c020d83d8238a538de849089a0d392be4893045022100edbb88822e17646651fa1f25700e304c05a2a9b1a968a735a0245665247d03a80220400d03132f75d5988e0d8f3331c05a724873fd13d2af0fd0a023ca3034641d77ff011e00bf24190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310200000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea3045022100ffce543d4b8d7ebed8d2ebdef75eca9cb2a83f6f0140899c2947451da31ef1ad02207367bd87a1dfb33171a49ba4a31562d602439ea98b42880d1f8aa828bf65021eff011e00bf24190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310300000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea3045022100a29adcf6812bdbce2b4d9d33b1d2007edbf43eba9db9bc36ad245e4acfddb47102205771a7f3f208dac19eb791f79d39d150b3b14912bc233bce72b23b084bd3d476ff011e00862519010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000002d676f6f73653a20766f746572732073686172652e205468616e6b20796f7521207c74782062792061726b2d676f9675400c00000000000000001ee51d5433e842b8f5393a9c9ba0a2cacf9e620d023045022100a523ea18aad4be535b669615487256dc5bac847c07ae8da447151e069e8bdf7802202597feef6a011c45bd6bcef8e6aebaa16037439725f31a46ebdc373117e9b8e5ff011e00b724190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310300000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea3045022100b61eae15cfbb04676bf00ce1320ca9316f3a5345a959ba9414225fb7115b7e4d02200666e11f0cf4644a6507c96d987f68a55055920264c53c86be1cda6f4dcee24dff011e00862519010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0809698000000000020676f6f7365204465764e65742046756e642e207c74782062792061726b2d676fb282070200000000000000001e41ac3c020d83d8238a538de849089a0d392be4893045022100bfbc9e7c67550326639d273399671d5eae5345f826529c83a55c11cb68d0092a022054627dbe51091dc9811f1f453a8944f50f0f2d372a71c106a9a380bad7da01b5ff011e00b724190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310200000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea304402206f1f4b1a76d8dcd4df0041e0282aa812be7b8dec349a461fe1ebb0baa5c4a5fd0220517e00ebca6f5fad2949e640cf7172269207fd1c3c5eaf4b210411fdcff32c1fff011e00be24190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310100000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea3044022012e5cc84e3f4ddd78541bc3d0cca77835c6ee923faeb0e49b08fc2025643662802201b7b61a059ee6de3c17b7c61271aaf1462350f21c49186d6cd4e7bd13b4e064fff011e00b724190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310100000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea304402207c5276a703dd648c812a6d6ee59f474e979f6aea5866d5ec559264b01e49c5250220577b835a74dd2ac2eb704629c542800f2843694adba679c24abe6d7744444ad9ff011e00be24190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310300000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea30440220158a2ccd30a0c546a264311e714edfb8014aaecd43720eacee3291eb2c61a295022018c300eec32fa00ea9dfe6f2c8806fbfe1cbbf641ccc0f7c60ea6f638aac52bbff011e00be24190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310200000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea3045022100f2660609fc2fbf25cfc84ba93a2c8ef5cae95ad3d01accccb26398e191196041022078982e7e42c31744031ba96fb04728631de3683cf30d2961560be79fa4a64506ff011e00bf24190102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c7065726620746573742023310100000000000000000000001e7143fd56b4ade52677fb877e02553c9a08745dea304402205dc5d2f914737fa8df63918a69ab795dd03580099b527ac9086d6368bbc45bcd02207ea804611de09bb79a54427678574c92dc3d7a18bd53809420572097becccd09',
        '0000000080341b01810018002ad26e6fc5deed3803000000b6fcab0c0000000080c3c9010000000000c2eb0b0000000060000000e6fc87c3ad48574e9407bae80b670eb13ebf3703331306c980ff13f7478df3cc03f5b199727b5caf1d33d81b83d19313aff8515009d4a7e48685cb61ebf56f2ffb3045022100ba773a1a201067c54d6b45ab9e67d5dbe590282ecb0211d600db3d116ccb0824022073343c775469392fbbc649c5ea4cf94b00f8b7a646933bf0ec81ba610a8997eeb5000000c6000000b9000000ff011e0066341b010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001c676f6f736520726573657276652e207c74782062792061726b2d676f3b16fa0000000000000000001e41ac3c020d83d8238a538de849089a0d392be489304402203df52c6870b7a177e166071da409218f583527115aefb9fbe0cfdc6f589c969902201d7a47c1210accb78347e4e313b4e5facc70d21050311bafc9b19b5ba298b937ff011e0066341b010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000002d676f6f73653a20766f746572732073686172652e205468616e6b20796f7521207c74782062792061726b2d676fc0391f0a00000000000000001ee51d5433e842b8f5393a9c9ba0a2cacf9e620d02304402206dd0f3877b05dc068ae76e8bfe2fca5a2a9c6fa04e3a99f534892c855ebe3dde02200363a219ea66857efd88a62e19af9be56aae8eed944134cdceb3348bf4a9fc41ff011e0066341b010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0809698000000000020676f6f7365204465764e65742046756e642e207c74782062792061726b2d676fbbac920100000000000000001e41ac3c020d83d8238a538de849089a0d392be4893044022074ef8c766d853a23def407ec2ec8e9813c3310a0a02c8b5ceb4511e6410f185d022010fd85f9fd4cd1ca13369c5ec00b7b6a98aa0669d4c5378b4e98da1e4a64e2b9',
        '00000000f8301b011c00180091c7652b2450690c0400000055ba4bc400000000005a62020000000000c2eb0b0000000080000000395e2bedb95411f8d87e821978b5beb7554ed06f6c101ea095f1ad0108e37f4e0266ec6b35766c81465af51b07e2e2f0bd45b01abd1662bdf673b1fe76aafe3df03045022100fbe10dca96230e73ce46c8298f3982885f82d6407b39128f52b57a5a3e66e230022003eac74392fbbbc131cef3a6d5fd431c84092132ce615f30c6f9d0640f2ceb86b0000000b1000000a5000000af000000ff011e00e5301b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000017636872697320626f74207c74782062792061726b2d676f120b640100000000000000001eb09c56caa5da3727181852feb4ec28437ee680f23044022026548fa6d17e51f5868a7069d98dabbbb233757d6a4ce557c145294d9366b967022019c6c3565850a8a9febddadd75f23031b49b3f8d09005298794c4d93173322eaff011e00e5301b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000017636872697320626f74207c74782062792061726b2d676f5a0024be00000000000000001ed421060ebd11f29b416a5802c55db49db93e27313045022100b69da543c02f052a8181c265abe39eda5c767309a343e460dc9213af767a2fcb02204616556146ca24407f648723a9548821874a43ed0a835f4abc52615f8e128adaff011e00e5301b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c74782062792061726b2d676fd7a35f0300000000000000001e7f048c40fd8a0442ffe79e0aa804f27fd5db159430440220372876dfb46d460b33b0821273f484b89ea4b0a96b2d1cd49d7e4b94b059ec4102206b2d19d7bb3c1c31284496686a6860f451d70e36470804b1f1f9eefad1f34ed8ff011e00e5301b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000016636872697320626f747c74782062792061726b2d676f120b640100000000000000001ed3348ec3a821e123661d40f92f876246a68023f23044022002bed17317243f2db7c5628d730c19832e22b9265ae16242e18557c2d0c882e4022054de01158b791d582009692b6f277f42b80e83e4e971a033035797c38495adf5',
        '00000000386b2b0187db1900e55de78db50f2cbb04000000083132bb00000000005a62020000000000c2eb0b00000000800000004162170808446d5bcdd88da6e1a85b7fc2a4dd97d60ee1cd39a239ece523f54b03d4ec98dfc6f3fe2ccb64a950534709ab6bb9134ae02205822f7cecf4391f03bd30440220493613ca8e3a628d1716166dab979f8a59caf91bb030f3c5bb151de6211fc60902202781ddf1bfa87eff30f5268e23921622280b305f61cf4204731a9089136ab6b6a5000000b0000000b1000000af000000ff011e00326b2b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c980969800000000000c74782062792061726b2d676fb10b310300000000000000001e7f048c40fd8a0442ffe79e0aa804f27fd5db159430440220506cd61192ccf52bd8289b9775e363a5b37b5ad70ec1f61ac65452bc9e58eee60220086e05ba2324fb175f8aa575262c6ece3b59e9bd5fd8ca56827acbf6c43a9684ff011e00326b2b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000017636872697320626f74207c74782062792061726b2d676f69a667b500000000000000001ed421060ebd11f29b416a5802c55db49db93e273130440220052bafded3c85372bedef4afaad4e94b8698bbbdb58511e858f05049257d306702207419a987b2b55800ae3aaccebb58a0ff169644a22441e0909e44c6e9f6d47344ff011e00326b2b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000017636872697320626f74207c74782062792061726b2d676f77bf4c0100000000000000001eb09c56caa5da3727181852feb4ec28437ee680f23045022100eda27367b5f81475d4208efb48043144fe8c4eb351e23b2890f8a6df07ef8f0b022018c3c6ab858dd2438e4638c0858fcee96706ba505f51f7fd1c64d0dfb3bcf26eff011e00326b2b0102bcfa0951a92e7876db1fb71996a853b57f996972ed059a950d910f7d541706c9809698000000000016636872697320626f747c74782062792061726b2d676f77bf4c0100000000000000001ed3348ec3a821e123661d40f92f876246a68023f2304402207e0fbc350e8f81ab4a76236772cae08a0e5bc9752cf962018d30372c1e44624702204b7f9ea71f24ef853f61bb6553a52c5a882c78906972ff2498cecd1997134267',
        '00000000d8566601ee4f20009b07bdb0aa81f0d0030000006b9138020000000080c3c9010000000000c2eb0b00000000600000008220084a6b78d25b4e7da7b2e6ea01fe46af23dd3d15cdad134dae541b0a98100275776018638e5c40f1b922901e96cac2caa734585ef302b4a2801ee9a338a45630440220713895f46593f74e0c2c79071e3c5d902ee96c7f3c61b84e472f8119192ec55402201192b673416b8782d607f0c061d0ee0af19c5c7f10e6ce2490e83ec427aa44ce00010000f9000000ff000000ff011e00d55666010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874b1f95b0000000000000000001e9daf5f70eb6ba962347f0c782559dfe3fe240c673045022100a3777bcd2b84509028354872befadecccb594ec00dde96efbd0ce368d154e1dd022030136fc55530a5fa00f5740587a1232e2211a8bcf44aed143e642fabbbc3410a3045022100f91d4fd4b0f8da6853b7ea3aa6ca9704a0715df973225780b5269404a3c6770d022030e192a9f3dd33fbb5cc07916fc8575af2be73f4bce611818b8a7fd0c82a02c9ff011e00cf5666010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001a666175636574202d205472756520426c6f636b2057656967687420d5860100000000000000001e6df4a0f58b398cb19e6d5258a7915c70981ce9613044022051fc06968e940ed228895cac64bfbc0f6e4274ccbeb94e1d9800e08fc49a9c6a022037d636e74e10d447afc06c4f80d5e00886aa46a3f079e21ae8be36b13c2f98d430440220475be5104d3884508b78d5da9dce7e0b3b8be1cc5f595e3a121c3c907105a54402204c6827dc428b0bfbc193edf71f8207b4766dcec67866b128c862c08a8678f339ff011e00d25666010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b205765696768749ac2550000000000000000001e97836063007c77e6a73b4deeca07f44bb13a524e3044022023b54bddf19d8810d09daa4ee5db1d2411ab3e36be3729f1ee48d18cf4dd9aee022063942ee0fda2552118e206c5bad52f90f644c4327f6c8f29d21ed951da5feb0b3045022100e2e8b73ac24ea431d50362e7a6f1a551c2fd3d02fe7db6420d1960e05c4e8cfa022064a30125ace8d15bd64bbe654c8bd499477ddd1746096cd4a890f6f9bf466954'
      ]
      serialiseds.forEach(s => console.log(new Block(Block.deserialize(s))))
    })

    describe('should validate hash', () => {
      const b = {
        'id': '7176646138626297930',
        'version': 0,
        'height': 2243161,
        'timestamp': 24760440,
        'previousBlock': '3112633353705641986',
        'numberOfTransactions': 7,
        'totalAmount': '3890300',
        'totalFee': '70000000',
        'reward': '200000000',
        'payloadLength': 224,
        'payloadHash': '3784b953afcf936bdffd43fdf005b5732b49c1fc6b11e195c364c20b2eb06282',
        'generatorPublicKey': '020f5df4d2bc736d12ce43af5b1663885a893fade7ee5e62b3cc59315a63e6a325',
        'blockSignature': '3045022100eee6c37b5e592e99811d588532726353592923f347c701d52912e6d583443e400220277ffe38ad31e216ba0907c4738fed19b2071246b150c72c0a52bae4477ebe29',
        'transactions': [
            {
                'type': 0,
                'amount': 555760,
                'fee': 10000000,
                'recipientId': 'DB4gFuDztmdGALMb8i1U4Z4R5SktxpNTAY',
                'timestamp': 24760418,
                'asset': {},
                'vendorField': 'Goose Voter - True Block Weight',
                'senderPublicKey': '0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0',
                'signature': '304402204f12469157b19edd06ba25fcad3d4a5ef5b057c23f9e02de4641e6f8eef0553e022010121ab282f83efe1043de9c16bbf2c6845a03684229a0d7c965ffb9abdfb978',
                'signSignature': '30450221008327862f0b9178d6665f7d6674978c5caf749649558d814244b1c66cdf945c40022015918134ef01fed3fe2a2efde3327917731344332724522c75c2799a14f78717',
                'id': '170543154a3b79459cbaa529f9f62b6f1342682799eb549dbf09fcca2d1f9c11',
                'senderId': 'DB8LnnQqYvHpG4WkGJ9AJWBYEct7G3yRZg',
                'hop': 2,
                'broadcast': false,
                'blockId': '7176646138626297930'
            },
            {
                'type': 0,
                'amount': 555750,
                'fee': 10000000,
                'recipientId': 'DGExsNogZR7JFa2656ZFP9TMWJYJh5djzQ',
                'timestamp': 24760416,
                'asset': {},
                'vendorField': 'Goose Voter - True Block Weight',
                'senderPublicKey': '0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0',
                'signature': '304402205f82feb8c5d1d79c565c2ff7badb93e4c9827b132d135dda11cb25427d4ef8ac02205ff136f970533c4ec4c7d0cd1ea7e02d7b62629b66c6c93265f608d7f2389727',
                'signSignature': '304402207e912031fcc700d8a55fbc415993302a0d8e6aea128397141b640b6dba52331702201fd1ad3984e42af44f548907add6cb7ad72ca0070c8cc1d8dc9bbda208c56bd9',
                'id': '1da153f37eceda233ff1b407ac18e47b3cae47c14cdcd5297d929618a916c4a7',
                'senderId': 'DB8LnnQqYvHpG4WkGJ9AJWBYEct7G3yRZg',
                'hop': 2,
                'broadcast': false,
                'blockId': '7176646138626297930'
            },
            {
                'type': 0,
                'amount': 555770,
                'fee': 10000000,
                'recipientId': 'DHGK5np6LuMMErfRfC5CmjpGu3ME85c25n',
                'timestamp': 24760420,
                'asset': {},
                'vendorField': 'Goose Voter - True Block Weight',
                'senderPublicKey': '0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0',
                'signature': '304502210083216e6969e068770e6d2fe5c244881002309df84d20290ddf3f858967ed010202202a479b3da5080ea475d310ff13494654b42db75886a8808bd211b4bdb9146a7a',
                'signSignature': '3045022100e1dcab3406bbeb968146a4a391909ce41df9b71592a753b001e7c2ee1d382c5102202a74aeafd4a152ec61854636fbae829c41f1416c1e0637a0809408394973099f',
                'id': '1e255f07dc25ce22d900ea81663c8f00d05a7b7c061e6fc3c731b05d642fa0b9',
                'senderId': 'DB8LnnQqYvHpG4WkGJ9AJWBYEct7G3yRZg',
                'hop': 2,
                'broadcast': false,
                'blockId': '7176646138626297930'
            },
            {
                'type': 0,
                'amount': 555750,
                'fee': 10000000,
                'recipientId': 'D7pcLJNGe197ibmWEmT8mM9KKU1htrcDyW',
                'timestamp': 24760417,
                'asset': {},
                'vendorField': 'Goose Voter - True Block Weight',
                'senderPublicKey': '0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0',
                'signature': '3045022100cd4fa9855227be11e17201419dacfbbd5d9946df8d6792a9488160025693821402207fb83969bad6a26959f437b5bb88e255b0a48eb04964d0c0d29f7ee94bd15e11',
                'signSignature': '304402205f50c2991a17743d17ffbb09159cadc35a3f848044261842879ccf5be9d81c5e022023bf21c32fb6e94494104f15f8d3a942ab120d0abd6fb4c93790b68e1b307a79',
                'id': '66336c61d6ec623f8a1d2fd156a0fac16a4fe93bb3fba337859355c2119923a8',
                'senderId': 'DB8LnnQqYvHpG4WkGJ9AJWBYEct7G3yRZg',
                'hop': 2,
                'broadcast': false,
                'blockId': '7176646138626297930'
            },
            {
                'type': 0,
                'amount': 555760,
                'fee': 10000000,
                'recipientId': 'DD4yhwzryQdNGqKtezmycToQv63g27Tqqq',
                'timestamp': 24760418,
                'asset': {},
                'vendorField': 'Goose Voter - True Block Weight',
                'senderPublicKey': '0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0',
                'signature': '30450221009c792062e13399ac6756b2e9f137194d06e106360ac0f3e24e55c7249cee0b3602205dc1d9c76d0451d1cb5a2396783a13e6d2d790ccfd49291e3d0a78349f7ea0e8',
                'signSignature': '30440220083ba8a9af49b8be6e93794d71ec43ffc96a158375810e5d9f2478e71655315b0220278402ecaa1d224dab9f0f3b28295bbaea339c85c7400edafdc49df87439fc64',
                'id': '78db36f7d79f51c67d7210ee3819dfb8d0d47b16a7484ebf55c5a055b17209a3',
                'senderId': 'DB8LnnQqYvHpG4WkGJ9AJWBYEct7G3yRZg',
                'hop': 2,
                'broadcast': false,
                'blockId': '7176646138626297930'
            },
            {
                'type': 0,
                'amount': 555760,
                'fee': 10000000,
                'recipientId': 'D5LiYGXL5keycWuTF6AFFwSRc6Mt4uEHMu',
                'timestamp': 24760419,
                'asset': {},
                'vendorField': 'Goose Voter - True Block Weight',
                'senderPublicKey': '0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0',
                'signature': '3044022063c65263e42be02bd9831b375c1d76a88332f00ed0557ecc1e7d2375ca40070902206797b5932c0bad68444beb5a38daa7cadf536ee2144e0d9777b812284d14374e',
                'signSignature': '3045022100b04da6692f75d43229ffd8486c1517e8952d38b4c03dfac38b6b360190a5c33e0220776622e5f09f92a1258b4a011f22181c977b622b8d1bbb2f83b42f4126d00739',
                'id': '83c80bb58777bb43f5037544b44ef69f191d3548fd1b2a00bed368f9f0d694c5',
                'senderId': 'DB8LnnQqYvHpG4WkGJ9AJWBYEct7G3yRZg',
                'hop': 2,
                'broadcast': false,
                'blockId': '7176646138626297930'
            },
            {
                'type': 0,
                'amount': 555750,
                'fee': 10000000,
                'recipientId': 'DPopNLwMvv4zSjdZnqUk8HFH13Mcb7NbEK',
                'timestamp': 24760416,
                'asset': {},
                'vendorField': 'Goose Voter - True Block Weight',
                'senderPublicKey': '0265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c0',
                'signature': '3045022100d4513c3608c2072e38e7a0e3bb8daf2cd5f7cc6fec9a5570dccd1eda696c591902202ecbbf3c9d0757be7b23c8b1cc6481c51600d158756c47fcb6f4a7f4893e31c4',
                'signSignature': '304402201fed4858d0806dd32220960900a871dd2f60e1f623af75feef9b1034a9a0a46402205a29b27c63fcc3e1ee1e77ecbbf4dd6e7db09901e7a09b9fd490cd68d62392cb',
                'id': 'd2faf992fdd5da96d6d15038b6ddb65230338fa2096e45e44da51daad5e2f3ca',
                'senderId': 'DB8LnnQqYvHpG4WkGJ9AJWBYEct7G3yRZg',
                'hop': 2,
                'broadcast': false,
                'blockId': '7176646138626297930'
            }
        ]
    }
      const s = Block.serializeFull(b).toString('hex')
      const serialized = '0000000078d07901593a22002b324b8b33a85802070000007c5c3b0000000000801d2c040000000000c2eb0b00000000e00000003784b953afcf936bdffd43fdf005b5732b49c1fc6b11e195c364c20b2eb06282020f5df4d2bc736d12ce43af5b1663885a893fade7ee5e62b3cc59315a63e6a3253045022100eee6c37b5e592e99811d588532726353592923f347c701d52912e6d583443e400220277ffe38ad31e216ba0907c4738fed19b2071246b150c72c0a52bae4477ebe29ff000000fe00000000010000ff000000ff000000ff000000ff000000ff011e0062d079010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874f07a080000000000000000001e40fad23d21da7a4fd4decb5c49726ea22f5e6bf6304402204f12469157b19edd06ba25fcad3d4a5ef5b057c23f9e02de4641e6f8eef0553e022010121ab282f83efe1043de9c16bbf2c6845a03684229a0d7c965ffb9abdfb97830450221008327862f0b9178d6665f7d6674978c5caf749649558d814244b1c66cdf945c40022015918134ef01fed3fe2a2efde3327917731344332724522c75c2799a14f78717ff011e0060d079010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874e67a080000000000000000001e79c579fb08f448879c22fe965906b4e3b88d02ed304402205f82feb8c5d1d79c565c2ff7badb93e4c9827b132d135dda11cb25427d4ef8ac02205ff136f970533c4ec4c7d0cd1ea7e02d7b62629b66c6c93265f608d7f2389727304402207e912031fcc700d8a55fbc415993302a0d8e6aea128397141b640b6dba52331702201fd1ad3984e42af44f548907add6cb7ad72ca0070c8cc1d8dc9bbda208c56bd9ff011e0064d079010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874fa7a080000000000000000001e84fee45dde2b11525afe192a2e991d014ff93a36304502210083216e6969e068770e6d2fe5c244881002309df84d20290ddf3f858967ed010202202a479b3da5080ea475d310ff13494654b42db75886a8808bd211b4bdb9146a7a3045022100e1dcab3406bbeb968146a4a391909ce41df9b71592a753b001e7c2ee1d382c5102202a74aeafd4a152ec61854636fbae829c41f1416c1e0637a0809408394973099fff011e0061d079010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874e67a080000000000000000001e1d69583ede5ee82d220e74bffb36bae2ce762dfb3045022100cd4fa9855227be11e17201419dacfbbd5d9946df8d6792a9488160025693821402207fb83969bad6a26959f437b5bb88e255b0a48eb04964d0c0d29f7ee94bd15e11304402205f50c2991a17743d17ffbb09159cadc35a3f848044261842879ccf5be9d81c5e022023bf21c32fb6e94494104f15f8d3a942ab120d0abd6fb4c93790b68e1b307a79ff011e0062d079010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874f07a080000000000000000001e56f9a37a859f4f84e93ce7593e809b15a524db2930450221009c792062e13399ac6756b2e9f137194d06e106360ac0f3e24e55c7249cee0b3602205dc1d9c76d0451d1cb5a2396783a13e6d2d790ccfd49291e3d0a78349f7ea0e830440220083ba8a9af49b8be6e93794d71ec43ffc96a158375810e5d9f2478e71655315b0220278402ecaa1d224dab9f0f3b28295bbaea339c85c7400edafdc49df87439fc64ff011e0063d079010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874f07a080000000000000000001e0232a083c16aba4362dddec1b3050ffdd6d43f2e3044022063c65263e42be02bd9831b375c1d76a88332f00ed0557ecc1e7d2375ca40070902206797b5932c0bad68444beb5a38daa7cadf536ee2144e0d9777b812284d14374e3045022100b04da6692f75d43229ffd8486c1517e8952d38b4c03dfac38b6b360190a5c33e0220776622e5f09f92a1258b4a011f22181c977b622b8d1bbb2f83b42f4126d00739ff011e0060d079010265c1f6b8c1966a90f3fed7bc32fd4f42238ab4938fdb2a4e7ddd01ae8b58b4c080969800000000001f476f6f736520566f746572202d205472756520426c6f636b20576569676874e67a080000000000000000001eccc4fce0dc95f9951ee40c09a7ae807746cf51403045022100d4513c3608c2072e38e7a0e3bb8daf2cd5f7cc6fec9a5570dccd1eda696c591902202ecbbf3c9d0757be7b23c8b1cc6481c51600d158756c47fcb6f4a7f4893e31c4304402201fed4858d0806dd32220960900a871dd2f60e1f623af75feef9b1034a9a0a46402205a29b27c63fcc3e1ee1e77ecbbf4dd6e7db09901e7a09b9fd490cd68d62392cb'
      const block1 = new Block(b)
      const block2 = new Block(Block.deserialize(serialized))

      expect(s).toEqual(serialized)
      expect(block1.verification.verified).toEqual(true)
      expect(block2.verification.verified).toEqual(true)
    })
  })

  describe('v1 fix', () => {
    const data2 = data
    const table = {
      '5139199631254983076': '1000099631254983076',
      '4683900276587456793': '1000000276587456793',
      '4719273207090574361': '1000073207090574361',
      '10008425497949974873': '10000425497949974873',
      '3011426208694781338': '1000026208694781338',
      '122506651077645039': '100006651077645039',
      '5720847785115142568': '1000047785115142568',
      '7018402152859193732': '1000002152859193732',
      '12530635932931954947': '10000635932931954947',
      '7061061305098280027': '1000061305098280027',
      '3983271186026110297': '1000071186026110297',
      '3546732630357730082': '1000032630357730082',
      '14024378732446299587': '10000378732446299587',
      '5160516564770509401': '1000016564770509401',
      '241883250703033792': '100003250703033792',
      '18238049267092652511': '10000049267092652511',
      '3824223895435898486': '1000023895435898486',
      '4888561739037785996': '1000061739037785996',
      '1256478353465481084': '1000078353465481084',
      '12598210368652133913': '10000210368652133913',
      '17559226088420912749': '10000226088420912749',
      '13894975866600060289': '10000975866600060289',
      '11710672157782824154': '10000672157782824154',
      '5509880884401609373': '1000080884401609373',
      '11486353335769396593': '10000353335769396593',
      '10147280738049458646': '10000280738049458646',
      '5684621525438367021': '1000021525438367021',
      '719490120693255848': '100000120693255848',
      '7154018532147250826': '1000018532147250826',
      '38016207884795383': '10000207884795383',
      '8324387831264270399': '1000087831264270399',
      '10123661368384267251': '10000661368384267251',
      '2222163236406460530': '1000063236406460530',
      '5059382813585250340': '1000082813585250340',
      '7091362542116598855': '1000062542116598855',
      '8225244493039935740': '1000044493039935740'
    }

    describe('outlook table', () => {
      it('should be an object', () => {
        expect(typeof Block.OUTLOOKTABLEFIX).toBe('object')
      })
      it('should have expected values in the outlook table', () => {
        expect(Block.OUTLOOKTABLEFIX).toEqual(table)
      })
      it('should be immutable', () => {
        expect(Block.OUTLOOKTABLEFIX[0] = 'any value').toThrow()
      })
      it('should return false when compared to changed values', () => {
        table[0] = 'any value'
        expect(table).not().toBe(Block.OUTLOOKTABLEFIX)
      })
    })
    describe('apply v1 fix', () => {
      it('should be a function', () => {
        expect(typeof Block.applyV1Fix).toBe('function')
      })
      it('should not process a common block', () => {
        expect(Block.applyV1Fix(data)).toBe(data)
      })
      it('should process a matching id', () => {
        data2.id = '8225244493039935740'
        expect(Block.applyV1Fix(data2)).not().toBe(data2)
      })
    })
  })
})
