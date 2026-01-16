#!/usr/bin/env python3

from setuptools import setup, find_packages

with open("requirements.txt") as f:
    requirements = f.read().splitlines()

setup(
    name="ggsperf",
    version="2.0.0",
    description="Fast Python Performance Tester for GoGame Service",
    author="Lenik",
    author_email="easyggs@bodz.net",
    packages=find_packages(),
    install_requires=requirements,
    entry_points={
        'console_scripts': [
            'ggsperf=ggsperf.ggsperf:main',
        ],
    },
    python_requires=">=3.7",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
