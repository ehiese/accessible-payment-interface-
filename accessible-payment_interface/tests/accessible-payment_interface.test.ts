import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock contract state
class MockMusicContract {
  constructor() {
    this.musicPrices = new Map([
      [1, { name: "Classical Collection", price: 9990000, available: true }],
      [2, { name: "Jazz Classics", price: 12990000, available: true }],
      [3, { name: "Golden Oldies", price: 8990000, available: true }]
    ]);
    
    this.userPurchases = new Map();
    this.nextPurchaseId = 1;
    this.totalSales = 0;
    this.contractOwner = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
  }

  // Mock contract functions
  getMusicInfo(musicId) {
    const music = this.musicPrices.get(musicId);
    return music ? { success: true, data: music } : { success: false, error: 101 };
  }

  purchaseMusic(musicId, userAddress) {
    const music = this.musicPrices.get(musicId);
    
    // Check if music exists and is available
    if (!music || !music.available) {
      return { success: false, error: 101 }; // err-invalid-music
    }

    // Check if user hasn't already purchased
    const purchaseKey = `${userAddress}-${musicId}`;
    if (this.userPurchases.has(purchaseKey)) {
      return { success: false, error: 103 }; // err-already-purchased
    }

    // Record purchase
    const purchaseId = this.nextPurchaseId++;
    this.userPurchases.set(purchaseKey, { purchased: true, purchaseId });
    this.totalSales += music.price;

    return {
      success: true,
      data: {
        musicName: music.name,
        pricePaid: music.price,
        purchaseId: purchaseId
      }
    };
  }

  hasPurchased(userAddress, musicId) {
    const purchaseKey = `${userAddress}-${musicId}`;
    const purchase = this.userPurchases.get(purchaseKey);
    return purchase ? purchase.purchased : false;
  }

  listAvailableMusic() {
    return Array.from(this.musicPrices.entries()).map(([id, music]) => ({
      id,
      ...music
    }));
  }

  getTotalSales() {
    return this.totalSales;
  }

  addMusic(musicId, name, price, userAddress) {
    if (userAddress !== this.contractOwner) {
      return { success: false, error: 100 }; // err-owner-only
    }

    this.musicPrices.set(musicId, { name, price, available: true });
    return { success: true };
  }

  toggleMusicAvailability(musicId, userAddress) {
    if (userAddress !== this.contractOwner) {
      return { success: false, error: 100 }; // err-owner-only
    }

    const music = this.musicPrices.get(musicId);
    if (!music) {
      return { success: false, error: 101 }; // err-invalid-music
    }

    music.available = !music.available;
    return { success: true };
  }
}

describe('Music Contract Mock Tests', () => {
  let contract;
  const testUser1 = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
  const testUser2 = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";
  const owner = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

  beforeEach(() => {
    contract = new MockMusicContract();
  });

  describe('Contract Initialization', () => {
    it('should initialize with correct music collections', () => {
      const classical = contract.getMusicInfo(1);
      const jazz = contract.getMusicInfo(2);
      const oldies = contract.getMusicInfo(3);

      expect(classical.success).toBe(true);
      expect(classical.data.name).toBe("Classical Collection");
      expect(classical.data.price).toBe(9990000);
      expect(classical.data.available).toBe(true);

      expect(jazz.success).toBe(true);
      expect(jazz.data.name).toBe("Jazz Classics");
      expect(jazz.data.price).toBe(12990000);

      expect(oldies.success).toBe(true);
      expect(oldies.data.name).toBe("Golden Oldies");
      expect(oldies.data.price).toBe(8990000);
    });

    it('should return error for non-existent music', () => {
      const result = contract.getMusicInfo(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe(101); // err-invalid-music
    });
  });

  describe('Music Purchase', () => {
    it('should allow user to purchase music successfully', () => {
      const result = contract.purchaseMusic(1, testUser1);
      
      expect(result.success).toBe(true);
      expect(result.data.musicName).toBe("Classical Collection");
      expect(result.data.pricePaid).toBe(9990000);
      expect(result.data.purchaseId).toBe(1);

      // Verify user now owns the music
      expect(contract.hasPurchased(testUser1, 1)).toBe(true);
    });

    it('should prevent duplicate purchases', () => {
      // First purchase should succeed
      const firstPurchase = contract.purchaseMusic(2, testUser1);
      expect(firstPurchase.success).toBe(true);

      // Second purchase should fail
      const secondPurchase = contract.purchaseMusic(2, testUser1);
      expect(secondPurchase.success).toBe(false);
      expect(secondPurchase.error).toBe(103); // err-already-purchased
    });

    it('should reject purchase of invalid music ID', () => {
      const result = contract.purchaseMusic(999, testUser1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(101); // err-invalid-music
    });

    it('should increment purchase IDs correctly', () => {
      const purchase1 = contract.purchaseMusic(1, testUser1);
      const purchase2 = contract.purchaseMusic(2, testUser2);
      const purchase3 = contract.purchaseMusic(3, testUser1);

      expect(purchase1.data.purchaseId).toBe(1);
      expect(purchase2.data.purchaseId).toBe(2);
      expect(purchase3.data.purchaseId).toBe(3);
    });

    it('should prevent purchase of unavailable music', () => {
      // Make music unavailable
      contract.toggleMusicAvailability(1, owner);
      
      // Try to purchase unavailable music
      const result = contract.purchaseMusic(1, testUser1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(101); // err-invalid-music
    });
  });

  describe('Admin Functions', () => {
    it('should allow owner to add new music', () => {
      const result = contract.addMusic(4, "Rock Classics", 11990000, owner);
      expect(result.success).toBe(true);

      // Verify new music was added
      const musicInfo = contract.getMusicInfo(4);
      expect(musicInfo.success).toBe(true);
      expect(musicInfo.data.name).toBe("Rock Classics");
      expect(musicInfo.data.price).toBe(11990000);
    });

    it('should prevent non-owner from adding music', () => {
      const result = contract.addMusic(5, "Pop Hits", 10990000, testUser1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(100); // err-owner-only
    });

    it('should allow owner to toggle music availability', () => {
      // Toggle availability off
      const result1 = contract.toggleMusicAvailability(1, owner);
      expect(result1.success).toBe(true);

      // Check music is now unavailable
      const musicInfo = contract.getMusicInfo(1);
      expect(musicInfo.data.available).toBe(false);

      // Toggle back on
      const result2 = contract.toggleMusicAvailability(1, owner);
      expect(result2.success).toBe(true);
      
      const musicInfo2 = contract.getMusicInfo(1);
      expect(musicInfo2.data.available).toBe(true);
    });

    it('should prevent non-owner from toggling availability', () => {
      const result = contract.toggleMusicAvailability(1, testUser1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(100); // err-owner-only
    });
  });

  describe('Data Tracking', () => {
    it('should track total sales correctly', () => {
      expect(contract.getTotalSales()).toBe(0);

      // Make some purchases
      contract.purchaseMusic(1, testUser1); // 9990000
      contract.purchaseMusic(2, testUser2); // 12990000

      expect(contract.getTotalSales()).toBe(22980000);
    });

    it('should track purchase ownership correctly', () => {
      expect(contract.hasPurchased(testUser1, 1)).toBe(false);
      
      contract.purchaseMusic(1, testUser1);
      
      expect(contract.hasPurchased(testUser1, 1)).toBe(true);
      expect(contract.hasPurchased(testUser2, 1)).toBe(false);
    });

    it('should list all available music', () => {
      const musicList = contract.listAvailableMusic();
      
      expect(musicList).toHaveLength(3);
      expect(musicList[0].name).toBe("Classical Collection");
      expect(musicList[1].name).toBe("Jazz Classics");
      expect(musicList[2].name).toBe("Golden Oldies");
    });
  });

  describe('Error Handling', () => {
    it('should return consistent error codes', () => {
      const errors = {
        ownerOnly: 100,
        invalidMusic: 101,
        insufficientPayment: 102,
        alreadyPurchased: 103
      };

      // Test owner-only error
      const ownerError = contract.addMusic(4, "Test", 1000, testUser1);
      expect(ownerError.error).toBe(errors.ownerOnly);

      // Test invalid music error
      const invalidError = contract.purchaseMusic(999, testUser1);
      expect(invalidError.error).toBe(errors.invalidMusic);

      // Test already purchased error
      contract.purchaseMusic(1, testUser1);
      const duplicateError = contract.purchaseMusic(1, testUser1);
      expect(duplicateError.error).toBe(errors.alreadyPurchased);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple users purchasing different music', () => {
      const purchases = [
        { user: testUser1, musicId: 1 },
        { user: testUser2, musicId: 2 },
        { user: testUser1, musicId: 3 }
      ];

      purchases.forEach(({ user, musicId }) => {
        const result = contract.purchaseMusic(musicId, user);
        expect(result.success).toBe(true);
      });

      // Verify ownership
      expect(contract.hasPurchased(testUser1, 1)).toBe(true);
      expect(contract.hasPurchased(testUser1, 3)).toBe(true);
      expect(contract.hasPurchased(testUser2, 2)).toBe(true);
      expect(contract.hasPurchased(testUser2, 1)).toBe(false);
    });

    it('should handle admin operations during active usage', () => {
      // Users make purchases
      contract.purchaseMusic(1, testUser1);
      contract.purchaseMusic(2, testUser2);

      // Owner adds new music
      contract.addMusic(4, "Country Classics", 9500000, owner);

      // User purchases new music
      const newPurchase = contract.purchaseMusic(4, testUser1);
      expect(newPurchase.success).toBe(true);

      // Owner disables music
      contract.toggleMusicAvailability(4, owner);

      // Another user tries to purchase disabled music
      const failedPurchase = contract.purchaseMusic(4, testUser2);
      expect(failedPurchase.success).toBe(false);
    });
  });
});