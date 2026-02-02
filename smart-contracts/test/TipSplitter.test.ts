import { expect } from "chai";
import { ethers } from "hardhat";
import { TipSplitter } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TipSplitter", function () {
    let tipSplitter: TipSplitter;
    let admin: HardhatEthersSigner;
    let feeRecipient: HardhatEthersSigner;
    let streamer: HardhatEthersSigner;
    let otherAccount: HardhatEthersSigner;

    const INITIAL_FEE_BPS = 100; // 1%

    beforeEach(async function () {
        [admin, feeRecipient, streamer, otherAccount] = await ethers.getSigners();

        const TipSplitterObj = await ethers.getContractFactory("TipSplitter");
        tipSplitter = await TipSplitterObj.deploy(feeRecipient.address, INITIAL_FEE_BPS);
    });

    describe("Deployment", function () {
        it("Should set the correct admin", async function () {
            expect(await tipSplitter.admin()).to.equal(admin.address);
        });

        it("Should set the correct fee address", async function () {
            expect(await tipSplitter.feeAddress()).to.equal(feeRecipient.address);
        });

        it("Should set the correct fee basis points", async function () {
            expect(await tipSplitter.feeBasisPoints()).to.equal(INITIAL_FEE_BPS);
        });
    });

    describe("Direct Tipping", function () {
        it("Should split the tip correctly (1% fee)", async function () {
            const amount = ethers.parseEther("1.0"); // 1 ETH
            const expectedFee = ethers.parseEther("0.01"); // 0.01 ETH
            const expectedTip = ethers.parseEther("0.99"); // 0.99 ETH

            await expect(
                tipSplitter.connect(otherAccount).tip(streamer.address, { value: amount })
            )
                .to.changeEtherBalances(
                    [otherAccount, feeRecipient, streamer],
                    [-amount, expectedFee, expectedTip]
                );
        });

        it("Should emit TipSent event", async function () {
            const amount = ethers.parseEther("1.0");
            const expectedFee = ethers.parseEther("0.01");

            await expect(
                tipSplitter.connect(otherAccount).tip(streamer.address, { value: amount })
            )
                .to.emit(tipSplitter, "TipSent")
                // sender, recipient, amount, fee
                .withArgs(otherAccount.address, streamer.address, ethers.parseEther("0.99"), expectedFee);
        });

        it("Should fail if tip is 0", async function () {
            await expect(
                tipSplitter.connect(otherAccount).tip(streamer.address, { value: 0 })
            ).to.be.revertedWith("Tip must be greater than 0");
        });
    });

    describe("Admin Functions", function () {
        describe("setAdmin", function () {
            it("Should allow admin to update admin", async function () {
                await tipSplitter.setAdmin(otherAccount.address);
                expect(await tipSplitter.admin()).to.equal(otherAccount.address);
            });

            it("Should prevent non-admin from updating admin", async function () {
                await expect(
                    tipSplitter.connect(otherAccount).setAdmin(otherAccount.address)
                ).to.be.revertedWith("Only admin can call this");
            });
        });

        describe("setFeeAddress", function () {
            it("Should allow admin to update fee address", async function () {
                await tipSplitter.setFeeAddress(otherAccount.address);
                expect(await tipSplitter.feeAddress()).to.equal(otherAccount.address);
            });

            it("Should prevent non-admin from updating fee address", async function () {
                await expect(
                    tipSplitter.connect(otherAccount).setFeeAddress(otherAccount.address)
                ).to.be.revertedWith("Only admin can call this");
            });
        });

        describe("setFeeBasisPoints", function () {
            it("Should allow admin to update fee percent", async function () {
                const newFee = 500; // 5%
                await tipSplitter.setFeeBasisPoints(newFee);
                expect(await tipSplitter.feeBasisPoints()).to.equal(newFee);
            });

            it("Should affect subsequent tips", async function () {
                const newFee = 5000; // 50%
                await tipSplitter.setFeeBasisPoints(newFee);

                const amount = ethers.parseEther("1.0");
                const expectedFee = ethers.parseEther("0.5");
                const expectedTip = ethers.parseEther("0.5");

                await expect(
                    tipSplitter.connect(otherAccount).tip(streamer.address, { value: amount })
                )
                    .to.changeEtherBalances(
                        [feeRecipient, streamer],
                        [expectedFee, expectedTip]
                    );
            });

            it("Should prevent non-admin from updating fee percent", async function () {
                await expect(
                    tipSplitter.connect(otherAccount).setFeeBasisPoints(500)
                ).to.be.revertedWith("Only admin can call this");
            });

            it("Should revert if fee > 100%", async function () {
                await expect(
                    tipSplitter.setFeeBasisPoints(10001)
                ).to.be.revertedWith("Fee cannot exceed 100%");
            });
        });
    });
});
